import { Popup } from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, LngLatLike, Map as MapLibreMap } from 'maplibre-gl'
import { COLONIA_SOURCE, COLONIA_SOURCE_LAYER } from './boundaries-layer'
import { REPORT_EXPIRY_MS, STATUS_COLORS, STATUS_LABELS } from './config'
import type { Colonia, ColoniaResumenProps, ReportStatus, ResumenCollection } from './types'

const SOURCE = 'resumen'

/** Capas que prende/apaga el control 🔢. */
export const RESUMEN_LAYERS = ['resumen-circulo', 'resumen-numero'] as const

const estadoColor: ExpressionSpecification = [
  'match', ['get', 'estado'],
  'no', STATUS_COLORS.no,
  'baja', STATUS_COLORS.baja,
  STATUS_COLORS.ok,
]

/**
 * Un círculo por colonia con el número de reportes vigentes, del color del
 * estado que más se reporta. El círculo va en un punto interior de la colonia,
 * no donde estaba nadie. Además tiñe el polígono de la colonia (feature-state).
 */
export function addResumenLayer(map: MapLibreMap): (data: ResumenCollection) => void {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  map.addLayer({
    id: 'resumen-circulo',
    type: 'circle',
    source: SOURCE,
    paint: {
      'circle-color': estadoColor,
      // Crece con el número de reportes, sin tapar la colonia
      'circle-radius': ['interpolate', ['linear'], ['get', 'total'], 1, 11, 10, 15, 50, 22],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  })

  map.addLayer({
    id: 'resumen-numero',
    type: 'symbol',
    source: SOURCE,
    layout: {
      'text-field': ['case', ['>', ['get', 'total'], 99], '99+', ['to-string', ['get', 'total']]],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      // Sobre amarillo el blanco casi no se lee
      'text-color': ['match', ['get', 'estado'], 'baja', '#1d2327', '#fff'],
    },
  })

  map.on('mouseenter', 'resumen-circulo', () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'resumen-circulo', () => (map.getCanvas().style.cursor = ''))

  // Colonias teñidas ahora mismo, para quitar el color a las que ya no tienen reportes
  const tenidas = new Set<number>()

  const syncTinte = (data: ResumenCollection) => {
    const siguientes = new Set<number>()
    for (const f of data.features) {
      const id = f.properties.colonia_id
      siguientes.add(id)
      map.setFeatureState(
        { source: COLONIA_SOURCE, sourceLayer: COLONIA_SOURCE_LAYER, id },
        { estado: f.properties.estado },
      )
    }
    for (const id of tenidas) {
      if (!siguientes.has(id)) {
        map.removeFeatureState({ source: COLONIA_SOURCE, sourceLayer: COLONIA_SOURCE_LAYER, id }, 'estado')
      }
    }
    tenidas.clear()
    siguientes.forEach((id) => tenidas.add(id))
  }

  // Agrupa varias actualizaciones en un solo setData por frame
  const source = map.getSource<GeoJSONSource>(SOURCE)!
  let pending: ResumenCollection | null = null
  return (data) => {
    if (!pending) requestAnimationFrame(() => {
      if (pending) {
        source.setData(pending)
        syncTinte(pending)
      }
      pending = null
    })
    pending = data
  }
}

export function setLayersVisible(map: MapLibreMap, ids: readonly string[], visible: boolean): void {
  for (const id of ids) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

// ─── Popup de colonia ───

const popup = new Popup({ closeButton: false, offset: 10, maxWidth: '240px' })
const HORAS = Math.round(REPORT_EXPIRY_MS / 3_600_000)

export function showColoniaPopup(
  map: MapLibreMap,
  lngLat: LngLatLike,
  colonia: Colonia,
  resumen?: ColoniaResumenProps,
): void {
  popup.setLngLat(lngLat).setDOMContent(popupContent(colonia, resumen)).addTo(map)
}

// DOM con textContent: nunca se arma HTML con datos
function popupContent(colonia: Colonia, r?: ColoniaResumenProps): HTMLElement {
  const el = document.createElement('div')
  el.className = 'report-popup'

  const title = document.createElement('strong')
  title.textContent = colonia.nombre || 'Colonia sin nombre'
  el.append(title)

  if (colonia.municipio) {
    const muni = document.createElement('p')
    muni.textContent = colonia.municipio
    el.append(muni)
  }

  if (!r) {
    const empty = document.createElement('p')
    empty.textContent = `Sin reportes en las últimas ${HORAS} h.`
    el.append(empty)
    return el
  }

  const rows: [ReportStatus, number][] = [
    ['no', r.sin_agua],
    ['baja', r.baja_presion],
    ['ok', r.con_agua],
  ]
  const list = document.createElement('ul')
  list.className = 'popup-conteo'
  for (const [status, count] of rows) {
    const li = document.createElement('li')
    const dot = document.createElement('span')
    dot.className = 'dot'
    dot.style.background = STATUS_COLORS[status]
    const label = document.createElement('span')
    label.textContent = STATUS_LABELS[status]
    const n = document.createElement('b')
    n.textContent = String(count)
    li.append(dot, label, n)
    list.append(li)
  }
  el.append(list)

  const foot = document.createElement('p')
  foot.className = 'popup-nota'
  foot.textContent = `${r.total} ${r.total === 1 ? 'reporte' : 'reportes'} en las últimas ${HORAS} h`
  el.append(foot)

  return el
}