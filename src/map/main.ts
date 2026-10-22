import 'maplibre-gl/dist/maplibre-gl.css'
import '../shared/tokens.css'
import './map.css'
// import './clima.css';

import { GeolocateControl, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
// MapLibre v6 busca su worker junto a su propio .mjs; con Vite (pre-bundle y build)
// ese archivo no existe, así que Vite empaqueta el worker y le pasamos su URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { connectRealtime, fetchResumen, fetchStats } from './api'
import {
  COLONIA_HIT_LAYER,
  COLONIA_LAYERS,
  COLONIA_SOURCE,
  COLONIA_SOURCE_LAYER,
  MUNICIPIO_LAYERS,
  addBoundaryLayers,
  coloniaAt,
  setSelectedColonia,
  toColonia,
} from './boundaries-layer'
import { BASEMAPS, DEFAULT_BASEMAP, addBasemaps } from './basemaps'
import { MAP_MAX_BOUNDS, MAP_MIN_ZOOM, MAP_STYLE_URL, REPORT_EXPIRY_MS, ZMG_CENTER, ZMG_ZOOM } from './config'
import { LocationError, getPosition, isInsideZmg } from './geolocation'
import { LayerControls } from './layer-controls'
import { HEAT_LAYERS, RESUMEN_LAYERS, RESUMEN_SOURCE, addResumenLayer, setLayersVisible } from './reports-layer'
import { initDonutMarkers } from './donut-markers'
import { ResumenStore } from './resumen-store'
import type { Colonia, ColoniaResumenProps } from './types'
import { errorMessage, initReportSheet } from './report-sheet'
import { initColoniaSheet } from './colonia-sheet'
import { initColoniaSearch } from './colonia-search'
import { initStatsPanel } from './stats-panel'
import { ROTACION_LAYERS, addRotacionLayers, setZonasHoy } from './rotacion-layer'
import { initRotacionPanel } from './rotacion-panel'
import { initColoniaHover } from './colonia-hover'
import { ClimaControl } from './climaLayer'
import { LegendControl } from './legend-control'

// Tras reportar, evita reportes repetidos por doble toque o impaciencia.
// El límite real lo pone la API (1 por hora por colonia desde la misma conexión);
// esto solo cuida al usuario honesto. Es corto para que pueda reportar enseguida
// la colonia correcta si se equivocó.
const REPORT_COOLDOWN_MS = 5_000

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
// Donas de conteos: se crean en el load; el botón de capas las prende/apaga
let donuts: ReturnType<typeof initDonutMarkers> | null = null
let conteosVisibles = true
const stats = initStatsPanel()
stats.load()
// Subtítulo del panel: el plazo sale de la misma constante que usa el resumen
const reportSub = document.querySelector<HTMLElement>('#report-sub')!
reportSub.textContent = `Reportes de vecinos de las últimas ${Math.round(REPORT_EXPIRY_MS / 3_600_000)} h. No son datos oficiales.`
const refresh = () => {
  const data = store.toGeoJSON()
  render?.(data)
  stats.update(data)
}

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

// Zonas del SIAPA: la casilla del botón de capas y el interruptor del panel de
// racionamiento se mantienen iguales (ver showZonas). Se declaran antes del control
// porque overlay() llama a sync de inmediato
let setZonasCheckbox: ((on: boolean) => void) | null = null
// Las zonas se ven desde el inicio
const ZONAS_AL_INICIO = true
let zonasVisibles = ZONAS_AL_INICIO
// Mapa de calor y municipios visibles al entrar; se apagan desde el botón de capas
const CALOR_AL_INICIO = true
const MUNICIPIOS_AL_INICIO = true
// Clima oculto por ahora (no se carga ni se muestra); poner en true para regresarlo
const CLIMA_VISIBLE = false

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
      initial: CALOR_AL_INICIO,
      onChange: (on) => setLayersVisible(map, HEAT_LAYERS, on),
    })
    .overlay({
      label: 'Número de reportes',
      initial: true,
      onChange: (on) => {
        conteosVisibles = on
        setLayersVisible(map, RESUMEN_LAYERS, on)
        donuts?.setVisible(on)
      },
    })
    .overlay({
      label: 'Zonas de racionamiento',
      initial: ZONAS_AL_INICIO,
      onChange: (on) => {
        showZonas(on)
        rotacion.setMapa(on)
      },
      sync: (setChecked) => (setZonasCheckbox = setChecked),
    })
    .overlay({
      label: 'Colonias',
      initial: true,
      onChange: (on) => setLayersVisible(map, COLONIA_LAYERS, on),
    })
    .overlay({
      label: 'Municipios',
      initial: MUNICIPIOS_AL_INICIO,
      onChange: (on) => setLayersVisible(map, MUNICIPIO_LAYERS, on),
    }),
  'top-right',
)
map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
map.addControl(geolocate, 'top-right')
// Leyenda: botón debajo del de ubicación
map.addControl(new LegendControl(), 'top-right')

// La atribución compacta se abre sola al cargar el estilo (MapLibre solo la cierra al
// arrastrar). Se deja cerrada: se abre con su botón "i".
function cerrarAtribucion(): void {
  map.getContainer().querySelector('.maplibregl-ctrl-attrib.maplibregl-compact')?.classList.remove('maplibregl-compact-show')
}
map.once('load', cerrarAtribucion)
map.once('idle', cerrarAtribucion)

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

// Abrir/cerrar el panel de reporte para ver más mapa. Al cerrarlo, measureBottom
// (ResizeObserver) baja los controles de abajo.
const panelToggle = document.querySelector<HTMLButtonElement>('#panel-toggle')!
const panelToggleLabel = document.querySelector<HTMLElement>('#panel-toggle-label')!
const panelBody = document.querySelector<HTMLElement>('#panel-body')!
function setPanelOpen(open: boolean): void {
  panelBody.hidden = !open
  panelToggle.setAttribute('aria-expanded', String(open))
  panelToggleLabel.textContent = open ? 'Ocultar' : 'Reportar'
}
panelToggle.addEventListener('click', () => setPanelOpen(panelBody.hidden))

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

/** Tocar la dona de una colonia: igual que tocar su polígono. */
function coloniaDesdeResumen(p: ColoniaResumenProps): void {
  // El resumen no trae CP: se toma del polígono si sus tiles ya están cargados
  const [poligono] = map.querySourceFeatures(COLONIA_SOURCE, {
    sourceLayer: COLONIA_SOURCE_LAYER,
    filter: ['==', ['id'], p.colonia_id],
  })
  const colonia = (poligono && toColonia(poligono)) || {
    id: p.colonia_id,
    nombre: p.nombre,
    municipio: p.municipio,
    cp: '',
  }
  if (colonia.id === selected?.id) clearColonia()
  else chooseColonia(colonia)
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
    throw new LocationError('Por ahora AguaJalisco solo funciona en la zona metropolitana de Guadalajara.')
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
    setLauncherMsg('Gracias. ¿No era tu colonia? Tócala en el mapa y reporta ahí.', 'ok')
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
  onRotacion: () => rotacion.open(),
})

// ─── Racionamiento programado (SIAPA) ───

/** Prende/apaga las zonas; si el mapa aún no carga, se aplica en el load. */
function showZonas(on: boolean): void {
  zonasVisibles = on
  if (mapReady) setLayersVisible(map, ROTACION_LAYERS, on)
  if (on) void rotacion.load() // "hoy" necesita el calendario
}

function marcarZonasHoy(): void {
  const data = rotacion.data
  if (mapReady && data) setZonasHoy(map, data.zonas.filter((z) => z.hoy).map((z) => z.zona))
}

const rotacion = initRotacionPanel({
  onMapaChange: (on) => {
    showZonas(on)
    setZonasCheckbox?.(on)
  },
  onData: marcarZonasHoy,
  onOpen: () => search.close(false),
})

// El interruptor del panel arranca igual que la capa, y el calendario se pide ya
// para marcar las zonas que tienen racionamiento hoy
rotacion.setMapa(zonasVisibles)
if (zonasVisibles) void rotacion.load()

// ─── Buscar colonia ───

const search = initColoniaSearch({
  onOpen: () => rotacion.close(false),
  getCenter: () => map.getCenter().toArray() as [number, number],
  onSelect: ({ id, nombre, municipio, cp, bbox }) => {
    chooseColonia({ id, nombre, municipio, cp: cp ?? '' })
    // Se acerca después de abrir la hoja para dejar libre lo que tapa: el panel
    // lateral en escritorio o la hoja de abajo en el teléfono. Leer offsetHeight ya
    // calcula el layout de la hoja recién abierta.
    // Tope para que el padding nunca sea mayor que el mapa (fitBounds no se movería)
    const sheetH = phone.matches ? Math.min(coloniaSheetEl.offsetHeight, window.innerHeight * 0.55) : 0
    map.fitBounds(bbox, {
      padding: phone.matches
        ? { top: 72, right: 56, bottom: sheetH + 24, left: 24 }
        : { top: 72, right: 72, bottom: 40, left: coloniaSheetEl.offsetWidth + 48 },
      maxZoom: 16,
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200,
    })
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

// El histórico solo lo sabe la API; se pide junto con el resumen y, tras un
// reporte en vivo, una vez cada pocos segundos aunque lleguen varios
let historicoTimer: number | undefined
async function loadHistorico(): Promise<void> {
  try {
    stats.setHistorico((await fetchStats()).historico)
  } catch (err) {
    console.error(err) // el resto del resumen sigue funcionando
  }
}
function scheduleHistorico(): void {
  window.clearTimeout(historicoTimer)
  historicoTimer = window.setTimeout(() => void loadHistorico(), 3_000)
}

async function loadResumen(): Promise<void> {
  controller?.abort()
  controller = new AbortController()
  try {
    store.replaceAll(await fetchResumen(controller.signal))
    refresh()
    void loadHistorico()
    setStatus('')
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return
    console.error(err)
    setStatus('No se pudieron cargar los reportes.')
    // Si nunca llegó un resumen, el panel no debe quedarse en "Cargando"
    if (!render) stats.fail()
  }
}

map.on('load', () => {
  // Raster de mapas base primero, para que queden debajo de todo lo demás
  setBasemap = addBasemaps(map)
  setBasemap(basemap)
  // Primero colonias y límite estatal para que queden debajo del resumen
  addBoundaryLayers(map)
  // Con mouse: nombre, CP y si la colonia está en las zonas de racionamiento
  initColoniaHover(map, { getRotacion: () => rotacion.data })
  render = addResumenLayer(map)
  donuts = initDonutMarkers(map, { source: RESUMEN_SOURCE, onColonia: coloniaDesdeResumen })
  donuts.setVisible(conteosVisibles)
  // Zonas del SIAPA: encima de colonias, debajo del mapa de calor y los conteos
  addRotacionLayers(map, HEAT_LAYERS[0])
  // Lluvia satelital: encima del mapa base y colonias, debajo de los conteos
  // Clima: encima de colonias y mapa base, debajo de los conteos de reportes
  if (CLIMA_VISIBLE) map.addControl(new ClimaControl({ beforeId: HEAT_LAYERS[0] }), 'bottom-left')

  mapReady = true
  setReportEnabled(true)
  if (zonasVisibles) setLayersVisible(map, ROTACION_LAYERS, true)
  // Las capas nacen visibles en el estilo; se aplica el estado inicial elegido arriba
  setLayersVisible(map, HEAT_LAYERS, CALOR_AL_INICIO)
  setLayersVisible(map, MUNICIPIO_LAYERS, MUNICIPIOS_AL_INICIO)
  marcarZonasHoy()
  void loadResumen()

  // Tocar una colonia abre su hoja y la deja elegida para reportar;
  // tocarla otra vez la deselecciona y cierra la hoja
  map.on('click', (e) => {
    // Las donas detienen su propio clic (donut-markers.ts): aquí solo llegan los polígonos
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
      scheduleHistorico()
    },
    onReconnect: () => void loadResumen(),
  })

  window.setInterval(() => {
    if (!document.hidden) void loadResumen()
  }, RESUMEN_REFRESH_MS)
})
