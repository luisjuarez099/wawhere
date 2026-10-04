import 'maplibre-gl/dist/maplibre-gl.css'
import '../shared/tokens.css'
import './map.css'

import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
// MapLibre v6 busca su worker junto a su propio .mjs; con Vite (pre-bundle y build)
// ese archivo no existe, así que Vite empaqueta el worker y le pasamos su URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { ApiError, connectRealtime, createReport, fetchResumen } from './api'
import {
  COLONIA_HIT_LAYER,
  COLONIA_LAYERS,
  addBoundaryLayers,
  coloniaAt,
  setSelectedColonia,
  toColonia,
} from './boundaries-layer'
import { MAP_MAX_BOUNDS, MAP_MIN_ZOOM, MAP_STYLE_URL, ZMG_CENTER, ZMG_ZOOM } from './config'
import { LocationError, getPosition, isInsideZmg } from './geolocation'
import { LayerControls } from './layer-controls'
import { RESUMEN_LAYERS, addResumenLayer, setLayersVisible, showColoniaPopup } from './reports-layer'
import { ResumenStore } from './resumen-store'
import type { Colonia, ReportStatus } from './types'

// Tras reportar, evita reportes repetidos por doble toque o impaciencia.
// El límite real lo pone la API; esto solo cuida al usuario honesto.
const REPORT_COOLDOWN_MS = 60_000

// Los reportes vencidos solo desaparecen al volver a pedir el resumen
const RESUMEN_REFRESH_MS = 120_000

const statusEl = document.querySelector<HTMLElement>('#map-status')!
const panel = document.querySelector<HTMLElement>('#report-panel')!
const reportButtons = panel.querySelectorAll<HTMLButtonElement>('[data-status]')
const reportMsg = document.querySelector<HTMLElement>('#report-msg')!
const reportTarget = document.querySelector<HTMLElement>('#report-target')!

const setStatus = (text: string) => {
  statusEl.textContent = text
}

setWorkerUrl(workerUrl)

const map = new MapLibreMap({
  container: 'map',
  style: MAP_STYLE_URL,
  center: ZMG_CENTER,
  zoom: ZMG_ZOOM,
  minZoom: MAP_MIN_ZOOM,
  maxBounds: MAP_MAX_BOUNDS,
  attributionControl: { compact: true },
})

const store = new ResumenStore()
let render: ReturnType<typeof addResumenLayer> | null = null
const refresh = () => render?.(store.toGeoJSON())

// ─── Ubicación del usuario (solo en esta pantalla, no se envía) ───

let userMarker: Marker | null = null

function showUser(lng: number, lat: number): void {
  if (!userMarker) {
    const el = document.createElement('div')
    el.className = 'user-dot'
    el.setAttribute('aria-label', 'Tu ubicación')
    userMarker = new Marker({ element: el })
  }
  userMarker.setLngLat([lng, lat]).addTo(map)
}

async function locateMe(button: HTMLButtonElement): Promise<void> {
  button.disabled = true
  try {
    const { coords } = await getPosition()
    showUser(coords.longitude, coords.latitude)
    map.flyTo({ center: [coords.longitude, coords.latitude], zoom: Math.max(map.getZoom(), 15) })
  } catch (err) {
    setStatus(err instanceof LocationError ? err.message : 'No pudimos obtener tu ubicación.')
  } finally {
    button.disabled = false
  }
}

/** Espera a que el mapa termine de moverse y de cargar tiles (con tope por si ya estaba quieto). */
function waitIdle(timeoutMs = 4_000): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs)
    map.once('idle', () => {
      window.clearTimeout(timer)
      resolve()
    })
    map.triggerRepaint()
  })
}

// ─── Controles ───

map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
map.addControl(
  new LayerControls()
    .toggle({
      icon: '🔢',
      label: 'Mostrar u ocultar el número de reportes por colonia',
      initial: true,
      onChange: (on) => setLayersVisible(map, RESUMEN_LAYERS, on),
    })
    .toggle({
      icon: '🏘️',
      label: 'Mostrar u ocultar colonias',
      initial: true,
      onChange: (on) => setLayersVisible(map, COLONIA_LAYERS, on),
    })
    .action({ icon: '📍', label: 'Ir a mi ubicación', onClick: locateMe }),
  'top-right',
)

// Los controles de abajo (atribución) quedan por encima del panel de reportes
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--panel-h', `${panel.offsetHeight}px`)
}).observe(panel)

// ─── Colonia elegida a mano ───

// Si hay una colonia elegida tocando el mapa, se reporta ahí sin pedir GPS
let selected: Colonia | null = null

function selectColonia(colonia: Colonia | null): void {
  selected = colonia
  setSelectedColonia(map, colonia?.id ?? null)

  if (!colonia) {
    reportTarget.hidden = true
    reportTarget.replaceChildren()
    return
  }

  const label = document.createElement('span')
  label.textContent = `Vas a reportar en ${colonia.nombre}.`
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'report-target-reset'
  reset.textContent = 'Usar mi ubicación'
  reset.addEventListener('click', () => selectColonia(null))
  reportTarget.replaceChildren(label, ' ', reset)
  reportTarget.hidden = false
}

// ─── Reportar ───

function setReportEnabled(enabled: boolean): void {
  reportButtons.forEach((b) => (b.disabled = !enabled))
}

/** Colonia del usuario según su GPS. La ubicación se usa aquí y no se envía. */
async function coloniaFromGps(): Promise<Colonia | null> {
  reportMsg.textContent = 'Obteniendo tu ubicación…'
  const { coords } = await getPosition()
  const { longitude, latitude } = coords

  if (!isInsideZmg(longitude, latitude)) {
    throw new LocationError('Por ahora wawhere solo funciona en la zona metropolitana de Guadalajara.')
  }

  showUser(longitude, latitude)
  reportMsg.textContent = 'Buscando tu colonia…'
  // Los tiles de colonias tienen que estar en pantalla para consultarlos
  map.jumpTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15) })
  await waitIdle()
  return coloniaAt(map, [longitude, latitude])
}

function errorMessage(err: unknown): string {
  if (err instanceof LocationError) return err.message
  if (err instanceof ApiError && err.status === 422) {
    return 'Esa colonia está fuera de la zona metropolitana de Guadalajara.'
  }
  if (err instanceof ApiError && err.status === 429) {
    return 'Enviaste varios reportes seguidos. Intenta de nuevo en unos minutos.'
  }
  return 'No se pudo enviar tu reporte. Intenta de nuevo.'
}

async function report(status: ReportStatus): Promise<void> {
  setReportEnabled(false)
  reportMsg.className = 'report-msg'
  try {
    const colonia = selected ?? (await coloniaFromGps())

    if (!colonia) {
      reportMsg.textContent = 'No encontramos tu colonia. Tócala en el mapa y vuelve a elegir cómo está el agua.'
      reportMsg.classList.add('report-msg--error')
      setReportEnabled(true)
      return
    }

    reportMsg.textContent = 'Enviando…'
    await createReport({ colonia_id: colonia.id, status })

    // El WebSocket también manda el conteo nuevo; esto cubre el caso de que esté desconectado
    void loadResumen()
    selectColonia(null)

    reportMsg.textContent = `Gracias. Tu reporte ya cuenta en ${colonia.nombre}. ¿No es tu colonia? Tócala en el mapa y reporta de nuevo en un minuto.`
    reportMsg.classList.add('report-msg--ok')
    window.setTimeout(() => setReportEnabled(true), REPORT_COOLDOWN_MS)
  } catch (err) {
    console.error(err)
    reportMsg.textContent = errorMessage(err)
    reportMsg.classList.add('report-msg--error')
    setReportEnabled(true)
  }
}

reportButtons.forEach((btn) =>
  btn.addEventListener('click', () => report(btn.dataset.status as ReportStatus)),
)

// ─── Datos ───

let controller: AbortController | null = null

async function loadResumen(): Promise<void> {
  controller?.abort()
  controller = new AbortController()
  try {
    store.replaceAll(await fetchResumen(controller.signal))
    refresh()
    setStatus('')
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return
    console.error(err)
    setStatus('No se pudieron cargar los reportes.')
  }
}

map.on('load', () => {
  // Primero colonias y límite estatal para que queden debajo del resumen
  addBoundaryLayers(map)
  render = addResumenLayer(map)
  setReportEnabled(true)
  void loadResumen()

  // Tocar una colonia muestra sus conteos y la deja elegida para reportar
  map.on('click', (e) => {
    const feature = map.queryRenderedFeatures(e.point, { layers: [COLONIA_HIT_LAYER] })[0]
    const colonia = feature ? toColonia(feature) : null
    if (!colonia) return
    selectColonia(colonia)
    showColoniaPopup(map, e.lngLat, colonia, store.get(colonia.id)?.properties)
  })

  // Tiempo real: cuando alguien reporta, llega el conteo nuevo de su colonia
  connectRealtime({
    onColoniaUpdate: (feature) => {
      store.upsert(feature)
      refresh()
    },
    onReconnect: () => void loadResumen(),
  })

  window.setInterval(() => {
    if (!document.hidden) void loadResumen()
  }, RESUMEN_REFRESH_MS)
})