import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { COLONIA_SOURCE, COLONIA_SOURCE_LAYER } from './boundaries-layer'
import { STATUS_COLORS } from './config'
import type { ResumenCollection } from './types'

const SOURCE = 'resumen'
const HEAT_SOURCE = 'resumen-calor'

export const CLUSTER_LAYER = 'resumen-grupo'

/** Capas que prende/apaga "Número de reportes": grupos y círculos por colonia. */
export const RESUMEN_LAYERS = [CLUSTER_LAYER, 'resumen-grupo-numero', 'resumen-circulo', 'resumen-numero'] as const

/** Capa que prende/apaga "Mapa de calor". Va debajo de los círculos. */
export const HEAT_LAYERS = ['resumen-calor'] as const

// Hasta este zoom las colonias cercanas se agrupan en un solo círculo
const CLUSTER_MAX_ZOOM = 13

const estadoColor: ExpressionSpecification = [
  'match', ['get', 'estado'],
  'no', STATUS_COLORS.no,
  'baja', STATUS_COLORS.baja,
  'fuga', STATUS_COLORS.fuga,
  STATUS_COLORS.ok,
]

// Estado del grupo: el que suma más reportes; en empate, el más grave (igual que la API
// por colonia): sin agua, fuga, baja presión, con agua
const maxConteo: ExpressionSpecification = [
  'max', ['get', 'sin_agua'], ['get', 'fugas'], ['get', 'baja_presion'], ['get', 'con_agua'],
]
const grupoEstado: ExpressionSpecification = [
  'case',
  ['==', ['get', 'sin_agua'], maxConteo], 'no',
  ['==', ['get', 'fugas'], maxConteo], 'fuga',
  ['==', ['get', 'baja_presion'], maxConteo], 'baja',
  'ok',
]
const grupoColor: ExpressionSpecification = [
  'match', grupoEstado,
  'no', STATUS_COLORS.no,
  'baja', STATUS_COLORS.baja,
  'fuga', STATUS_COLORS.fuga,
  STATUS_COLORS.ok,
]

const sinGrupo: ExpressionSpecification = ['!', ['has', 'point_count']]
const esGrupo: ExpressionSpecification = ['has', 'point_count']

/**
 * Reportes por colonia en tres capas, todas sobre el punto interior de cada
 * colonia (nunca la ubicación de nadie):
 * - Mapa de calor de los reportes de problemas (sin agua, fugas y baja presión).
 * - Grupos: a zoom bajo, las colonias cercanas se juntan en un círculo con la
 *   suma de sus reportes, del color del estado que más se reporta.
 * - Círculo por colonia al acercarse, con su número de reportes (las fugas
 *   cuentan como un reporte más de la colonia).
 * Además tiñe el polígono de cada colonia con su estado (feature-state).
 */
export function addResumenLayer(map: MapLibreMap): (data: ResumenCollection) => void {
  const empty: ResumenCollection = { type: 'FeatureCollection', features: [] }

  map.addSource(SOURCE, {
    type: 'geojson',
    data: empty,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    // Cada grupo suma los conteos de sus colonias
    clusterProperties: {
      total: ['+', ['get', 'total']],
      sin_agua: ['+', ['get', 'sin_agua']],
      baja_presion: ['+', ['get', 'baja_presion']],
      con_agua: ['+', ['get', 'con_agua']],
      fugas: ['+', ['get', 'fugas']],
    },
  })
  // Fuente aparte sin agrupar: el mapa de calor necesita cada colonia
  map.addSource(HEAT_SOURCE, { type: 'geojson', data: empty })

  map.addLayer({
    id: 'resumen-calor',
    type: 'heatmap',
    source: HEAT_SOURCE,
    maxzoom: 15,
    paint: {
      // Pesan los problemas: "con agua" no debe calentar una zona
      'heatmap-weight': [
        'interpolate', ['linear'],
        ['+', ['get', 'sin_agua'], ['*', 0.5, ['+', ['get', 'baja_presion'], ['get', 'fugas']]]],
        0, 0,
        10, 1,
      ],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 25, 11, 40, 14, 60],
      // Morados: distintos de los colores de suministro (verde, amarillo, rojo)
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(94, 60, 153, 0)',
        0.2, 'rgba(158, 154, 200, 0.45)',
        0.45, 'rgba(117, 107, 177, 0.6)',
        0.7, 'rgba(84, 39, 143, 0.7)',
        1, 'rgba(63, 0, 125, 0.8)',
      ],
      // Se desvanece al acercarse, cuando ya se ven las colonias
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0],
    },
  })

  map.addLayer({
    id: CLUSTER_LAYER,
    type: 'circle',
    source: SOURCE,
    filter: esGrupo,
    paint: {
      'circle-color': grupoColor,
      'circle-radius': ['interpolate', ['linear'], ['get', 'total'], 2, 16, 20, 22, 100, 30],
      'circle-stroke-width': 3,
      'circle-stroke-color': '#fff',
      'circle-stroke-opacity': 0.9,
    },
  })

  map.addLayer({
    id: 'resumen-grupo-numero',
    type: 'symbol',
    source: SOURCE,
    filter: esGrupo,
    layout: {
      'text-field': ['case', ['>', ['get', 'total'], 999], '999+', ['to-string', ['get', 'total']]],
      'text-font': ['Noto Sans Regular'],
      'text-size': 13,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': ['match', grupoEstado, 'baja', '#1d2327', '#fff'],
    },
  })

  map.addLayer({
    id: 'resumen-circulo',
    type: 'circle',
    source: SOURCE,
    filter: sinGrupo,
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
    filter: sinGrupo,
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

  // Tocar un grupo acerca el mapa hasta que se separe
  map.on('click', CLUSTER_LAYER, async (e) => {
    const feature = e.features?.[0]
    if (!feature || feature.geometry.type !== 'Point') return
    const zoom = await map.getSource<GeoJSONSource>(SOURCE)!.getClusterExpansionZoom(feature.properties.cluster_id)
    map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
  })
  for (const layer of [CLUSTER_LAYER, 'resumen-circulo']) {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
  }

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
  const heatSource = map.getSource<GeoJSONSource>(HEAT_SOURCE)!
  let pending: ResumenCollection | null = null
  return (data) => {
    if (!pending) requestAnimationFrame(() => {
      if (pending) {
        source.setData(pending)
        heatSource.setData(pending)
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

