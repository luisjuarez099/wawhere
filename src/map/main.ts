import 'maplibre-gl/dist/maplibre-gl.css'
import '../shared/tokens.css'
import './map.css'
// import './clima.css';

import { GeolocateControl, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
// MapLibre v6 busca su worker junto a su propio .mjs; con Vite (pre-bundle y build)
// ese archivo no existe, así que Vite empaqueta el worker y le pasamos su URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { connectRealtime, fetchResumen } from './api'
import {
  COLONIA_HIT_LAYER,
  COLONIA_LAYERS,
  MUNICIPIO_LAYERS,
  addBoundaryLayers,
  coloniaAt,
  setSelectedColonia,
  toColonia,
} from './boundaries-layer'
import { BASEMAPS, DEFAULT_BASEMAP, addBasemaps } from './basemaps'
import { MAP_MAX_BOUNDS, MAP_MIN_ZOOM, MAP_STYLE_URL, ZMG_CENTER, ZMG_ZOOM } from './config'
import { LocationError, getPosition, isInsideZmg } from './geolocation'
import { LayerControls } from './layer-controls'
import { CLUSTER_LAYER, HEAT_LAYERS, RESUMEN_LAYERS, addResumenLayer, setLayersVisible } from './reports-layer'
import { ResumenStore } from './resumen-store'
import type { Colonia } from './types'
import { errorMessage, initReportSheet } from './report-sheet'
import { initColoniaSheet } from './colonia-sheet'
import { ClimaControl } from './climaLayer'

// Tras reportar, evita reportes repetidos por doble toque o impaciencia.
// El límite real lo pone la API; esto solo cuida al usuario honesto.
const REPORT_COOLDOWN_MS = 60_000

// Los reportes vencidos solo desaparecen al volver a pedir el resumen
const RESUMEN_REFRESH_MS = 120_000

const statusEl = document.querySelector<HTMLElement>('#map-status')!
const launcher = document.querySelector<HTMLElement>('#report-launcher')!
const coloniaSheetEl = document.querySelector<HTMLElement>('#colonia-sheet')!
const phone = window.matchMedia('(max-width: 767px)')
const reportOpen = document.querySelector<HTMLButtonElement>('#report-open')!
const reportMsg = document.querySelector<HTMLElement>('#launcher-msg')!
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
  attributionControl: {
    compact: true,
    customAttribution:
      'Colonias: <a href="https://iieg.gob.mx/ns/" target="_blank" rel="noopener">IIEG Jalisco</a> · ' +
      'Municipios: <a href="https://www.inegi.org.mx/temas/mg/" target="_blank" rel="noopener">INEGI</a>',
  },
})

const store = new ResumenStore()
let render: ReturnType<typeof addResumenLayer> | null = null
const refresh = () => render?.(store.toGeoJSON())

// ─── Ubicación del usuario (solo en esta pantalla, no se envía) ───

let userMarker: Marker | null = null

function showUser(lng: number, lat: number): void {
  if (!userMarker) {
    const el = document.createElement('div')
    // Mismo punto azul que usa el GeolocateControl de MapLibre
    el.className = 'maplibregl-user-location-dot'
    el.setAttribute('aria-label', 'Tu ubicación')
    userMarker = new Marker({ element: el })
  }
  userMarker.setLngLat([lng, lat]).addTo(map)
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

// Mapa base elegido; se recuerda en este navegador
const BASEMAP_KEY = 'wawhere:basemap'
let basemap = DEFAULT_BASEMAP
try {
  const saved = localStorage.getItem(BASEMAP_KEY)
  if (saved && BASEMAPS.some((b) => b.id === saved)) basemap = saved
} catch {
  // Sin almacenamiento: se queda el mapa base por defecto
}
let setBasemap: ((id: string) => void) | null = null

const geolocate = new GeolocateControl({
  positionOptions: { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
  fitBoundsOptions: { maxZoom: 15 },
})
// El control dibuja su propio punto; se quita el del reporte para no ver dos
geolocate.on('geolocate', () => userMarker?.remove())
geolocate.on('error', (err) => {
  setStatus(
    err.code === 1 // PERMISSION_DENIED
      ? 'Activa el permiso de ubicación del navegador para ir a tu ubicación.'
      : 'No pudimos obtener tu ubicación.',
  )
})

map.addControl(
  new LayerControls()
    .basemaps(BASEMAPS, basemap, (id) => {
      basemap = id
      setBasemap?.(id)
      try {
        localStorage.setItem(BASEMAP_KEY, id)
      } catch {
        // Sin almacenamiento: solo dura esta visita
      }
    })
    .overlay({
      label: 'Mapa de calor',
      initial: true,
      onChange: (on) => setLayersVisible(map, HEAT_LAYERS, on),
    })
    .overlay({
      label: 'Número de reportes',
      initial: true,
      onChange: (on) => setLayersVisible(map, RESUMEN_LAYERS, on),
    })
    .overlay({
      label: 'Colonias',
      initial: true,
      onChange: (on) => setLayersVisible(map, COLONIA_LAYERS, on),
    })
    .overlay({
      label: 'Municipios',
      initial: true,
      onChange: (on) => setLayersVisible(map, MUNICIPIO_LAYERS, on),
    }),
  'top-right',
)
map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
map.addControl(geolocate, 'top-right')

// Los controles de abajo (atribución) quedan por encima de lo que esté abajo:
// el panel fijo o, en el teléfono, la hoja de colonia. La hoja de reporte no
// cuenta: es modal en el teléfono y lateral en escritorio.
function measureBottom(): void {
  const colonia = phone.matches && !coloniaSheetEl.hidden ? coloniaSheetEl.offsetHeight : 0
  document.documentElement.style.setProperty('--panel-h', `${Math.max(launcher.offsetHeight, colonia)}px`)
}
const bottomObserver = new ResizeObserver(measureBottom)
bottomObserver.observe(launcher)
bottomObserver.observe(coloniaSheetEl)
phone.addEventListener('change', measureBottom)

// ─── Colonia elegida a mano ───

// Si hay una colonia elegida tocando el mapa, se reporta ahí sin pedir GPS
let selected: Colonia | null = null

function selectColonia(colonia: Colonia | null): void {
  selected = colonia
  setSelectedColonia(map, colonia?.id ?? null)
  reportOpen.textContent = colonia ? `Reportar en ${colonia.nombre}` : 'Reportar aquí'

  if (!colonia) {
    reportTarget.hidden = true
    reportTarget.replaceChildren()
    return
  }

  const label = document.createElement('span')
  label.textContent = 'Elegiste una colonia en el mapa.'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'report-target-reset'
  reset.textContent = 'Usar mi ubicación'
  reset.addEventListener('click', clearColonia)
  reportTarget.replaceChildren(label, ' ', reset)
  reportTarget.hidden = false
}

/** Elige la colonia y abre su hoja con sus conteos. */
function chooseColonia(colonia: Colonia): void {
  selectColonia(colonia)
  void coloniaSheet.open(colonia, store.get(colonia.id)?.properties)
}

function clearColonia(): void {
  selectColonia(null)
  coloniaSheet.close()
}

// ─── Reportar ───

let coolingDown = false
let mapReady = false

function setReportEnabled(enabled: boolean): void {
  reportOpen.disabled = !enabled || coolingDown || !mapReady
  coloniaSheet.setReportEnabled(!coolingDown)
}

function setLauncherMsg(text: string, kind?: 'ok' | 'error'): void {
  reportMsg.textContent = text
  reportMsg.className = kind ? `report-msg report-msg--${kind}` : 'report-msg'
}

/** Colonia del usuario según su GPS. La ubicación se usa aquí y no se envía. */
async function coloniaFromGps(): Promise<Colonia | null> {
  setLauncherMsg('Obteniendo tu ubicación…')
  const { coords } = await getPosition()
  const { longitude, latitude } = coords

  if (!isInsideZmg(longitude, latitude)) {
    throw new LocationError('Por ahora wawhere solo funciona en la zona metropolitana de Guadalajara.')
  }

  showUser(longitude, latitude)
  setLauncherMsg('Buscando tu colonia…')
  // Los tiles de colonias tienen que estar en pantalla para consultarlos
  map.jumpTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15) })
  await waitIdle()
  return coloniaAt(map, [longitude, latitude])
}

const sheet = initReportSheet({
  onSent: (_report, colonia) => {
    // El WebSocket también manda el conteo nuevo; esto cubre el caso de que esté desconectado
    void loadResumen()
    if (coloniaSheet.current?.id === colonia.id) {
      // La hoja de colonia sigue abierta debajo: se actualiza con el reporte nuevo
      void coloniaSheet.open(colonia, store.get(colonia.id)?.properties)
    } else {
      selectColonia(null)
    }
    setLauncherMsg('Gracias. ¿No era tu colonia? Tócala en el mapa y reporta de nuevo en un minuto.', 'ok')
    coolingDown = true
    setReportEnabled(false)
    window.setTimeout(() => {
      coolingDown = false
      setReportEnabled(true)
    }, REPORT_COOLDOWN_MS)
  },
  onChangeColonia: () => {
    clearColonia()
    setLauncherMsg('Toca tu colonia en el mapa para reportar ahí.')
    map.getCanvas().focus()
  },
})

const coloniaSheet = initColoniaSheet({
  onReport: (colonia, trigger) => {
    setLauncherMsg('')
    sheet.open(colonia, 'map', trigger)
  },
  onClose: () => {
    selectColonia(null)
    reportOpen.focus()
  },
})

reportOpen.addEventListener('click', async () => {
  if (selected) {
    setLauncherMsg('')
    sheet.open(selected, 'map', reportOpen)
    return
  }
  setReportEnabled(false)
  try {
    const colonia = await coloniaFromGps()
    if (!colonia) {
      setLauncherMsg('No encontramos tu colonia. Tócala en el mapa para reportar ahí.', 'error')
      return
    }
    setLauncherMsg('')
    sheet.open(colonia, 'gps', reportOpen)
  } catch (err) {
    console.error(err)
    setLauncherMsg(errorMessage(err), 'error')
  } finally {
    setReportEnabled(true)
  }
})

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
  // Raster de mapas base primero, para que queden debajo de todo lo demás
  setBasemap = addBasemaps(map)
  setBasemap(basemap)
  // Primero colonias y límite estatal para que queden debajo del resumen
  addBoundaryLayers(map)
  render = addResumenLayer(map)
  // Lluvia satelital: encima del mapa base y colonias, debajo de los conteos
  // Clima: encima de colonias y mapa base, debajo de los conteos de reportes
  map.addControl(new ClimaControl({ beforeId: HEAT_LAYERS[0] }), 'bottom-left')

  mapReady = true
  setReportEnabled(true)
  void loadResumen()

  // Tocar una colonia abre su hoja y la deja elegida para reportar;
  // tocarla otra vez la deselecciona y cierra la hoja
  map.on('click', (e) => {
    // Tocar un grupo acerca el mapa (reports-layer.ts); no elige la colonia de abajo
    if (map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] }).length) return
    const feature = map.queryRenderedFeatures(e.point, { layers: [COLONIA_HIT_LAYER] })[0]
    const colonia = feature ? toColonia(feature) : null
    if (!colonia) return
    if (colonia.id === selected?.id) clearColonia()
    else chooseColonia(colonia)
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
