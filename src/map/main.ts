import 'maplibre-gl/dist/maplibre-gl.css'
import '../shared/tokens.css'
import './map.css'

import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
// MapLibre v6 busca su worker junto a su propio .mjs; con Vite (pre-bundle y build)
// ese archivo no existe, así que Vite empaqueta el worker y le pasamos su URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { connectRealtime, createReport, fetchReports } from './api'
import { COLONIA_LAYERS, addBoundaryLayers } from './boundaries-layer'
import { MAP_MAX_BOUNDS, MAP_MIN_ZOOM, MAP_STYLE_URL, REPORT_EXPIRY_MS, ZMG_CENTER, ZMG_ZOOM } from './config'
import { LocationError, getPosition, isInsideZmg } from './geolocation'
import { LayerControls } from './layer-controls'
import { ReportStore } from './report-store'
import { LAYERS, addReportsLayer, setLayersVisible } from './reports-layer'
import type { Bounds, ReportStatus } from './types'

// Tras reportar, evita reportes repetidos por doble toque o impaciencia.
// El límite real tiene que ponerlo la API; esto solo cuida al usuario honesto.
const REPORT_COOLDOWN_MS = 60_000

const statusEl = document.querySelector<HTMLElement>('#map-status')!
const panel = document.querySelector<HTMLElement>('#report-panel')!
const reportButtons = panel.querySelectorAll<HTMLButtonElement>('[data-status]')
const reportMsg = document.querySelector<HTMLElement>('#report-msg')!

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

const store = new ReportStore(REPORT_EXPIRY_MS)
let render: ReturnType<typeof addReportsLayer> | null = null
const refresh = () => render?.(store.toGeoJSON())

// ─── Ubicación del usuario ───

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

// ─── Controles ───

map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
map.addControl(
  new LayerControls()
    .toggle({
      icon: '🔥',
      label: 'Mostrar u ocultar zonas de calor',
      initial: true,
      onChange: (on) => setLayersVisible(map, LAYERS.heatmap, on),
    })
    .toggle({
      icon: '🏘️',
      label: 'Mostrar u ocultar colonias',
      initial: true,
      onChange: (on) => setLayersVisible(map, COLONIA_LAYERS, on),
    })
    .toggle({
      icon: '📌',
      label: 'Mostrar u ocultar reportes individuales',
      initial: true,
      onChange: (on) => setLayersVisible(map, LAYERS.points, on),
    })
    .action({ icon: '📍', label: 'Ir a mi ubicación', onClick: locateMe }),
  'top-right',
)

// Los controles de abajo (atribución) quedan por encima del panel de reportes
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--panel-h', `${panel.offsetHeight}px`)
}).observe(panel)

// ─── Reportar ───

function setReportEnabled(enabled: boolean): void {
  reportButtons.forEach((b) => (b.disabled = !enabled))
}

async function report(status: ReportStatus): Promise<void> {
  setReportEnabled(false)
  reportMsg.className = 'report-msg'
  try {
    reportMsg.textContent = 'Obteniendo tu ubicación…'
    const { coords } = await getPosition()
    const { longitude, latitude } = coords

    if (!isInsideZmg(longitude, latitude)) {
      reportMsg.textContent = 'Por ahora wawhere solo funciona en la zona metropolitana de Guadalajara.'
      setReportEnabled(true)
      return
    }

    showUser(longitude, latitude)
    reportMsg.textContent = 'Enviando…'
    // La API busca la colonia con la ubicación exacta y guarda las coordenadas redondeadas (~100 m)
    const saved = await createReport({ latitude, longitude, status })

    // El WebSocket también lo va a mandar; el store lo deduplica por id
    store.upsert([saved])
    refresh()
    map.easeTo({ center: [saved.longitude, saved.latitude], zoom: Math.max(map.getZoom(), 14) })

    reportMsg.textContent = saved.colonia
      ? `Gracias. Tu reporte en ${saved.colonia} ya aparece en el mapa.`
      : 'Gracias. Tu reporte ya aparece en el mapa.'
    reportMsg.classList.add('report-msg--ok')
    window.setTimeout(() => setReportEnabled(true), REPORT_COOLDOWN_MS)
  } catch (err) {
    console.error(err)
    reportMsg.textContent =
      err instanceof LocationError ? err.message : 'No se pudo enviar tu reporte. Intenta de nuevo.'
    reportMsg.classList.add('report-msg--error')
    setReportEnabled(true)
  }
}

reportButtons.forEach((btn) =>
  btn.addEventListener('click', () => report(btn.dataset.status as ReportStatus)),
)

// ─── Datos ───

map.on('load', () => {
  // Primero colonias y límite estatal para que queden debajo de los reportes
  addBoundaryLayers(map)
  render = addReportsLayer(map)
  setReportEnabled(true)

  // Carga por viewport: pide un área 50% más grande que la vista y no vuelve
  // a pedir mientras el usuario se mueva dentro de ella.
  let loaded: Bounds | null = null
  let controller: AbortController | null = null
  let debounce: number | undefined

  const load = async (force = false) => {
    const view = viewBounds()
    if (!force && loaded && contains(loaded, view)) return

    controller?.abort()
    controller = new AbortController()
    const area = pad(view, 0.5)
    try {
      store.upsert(await fetchReports(area, controller.signal))
      loaded = area
      store.prune()
      refresh()
      setStatus('')
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
      console.error(err)
      setStatus('No se pudieron cargar los reportes.')
    }
  }

  map.on('moveend', () => {
    window.clearTimeout(debounce)
    debounce = window.setTimeout(load, 250)
  })
  load()

  // Tiempo real: lo que reporta cualquiera aparece aquí al instante
  connectRealtime({
    onReport: (r) => {
      store.upsert([r])
      refresh()
    },
    onReconnect: () => load(true),
  })

  // Quita reportes vencidos sin esperar a que el usuario mueva el mapa
  window.setInterval(() => {
    if (!document.hidden && store.prune()) refresh()
  }, 60_000)
})

function viewBounds(): Bounds {
  const b = map.getBounds()
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
}

function pad(b: Bounds, ratio: number): Bounds {
  const dx = (b.east - b.west) * ratio
  const dy = (b.north - b.south) * ratio
  return { west: b.west - dx, south: b.south - dy, east: b.east + dx, north: b.north + dy }
}

function contains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  )
}
