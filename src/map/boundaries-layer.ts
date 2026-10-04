import type {
  ExpressionSpecification,
  LngLatLike,
  MapGeoJSONFeature,
  Map as MapLibreMap,
} from 'maplibre-gl'
import { API_URL, STATUS_COLORS } from './config'
import type { Colonia } from './types'

export const COLONIA_SOURCE = 'colonias'
export const COLONIA_SOURCE_LAYER = 'colonias'

/** Capas que prende/apaga el control 🏘️. */
export const COLONIA_LAYERS = ['colonias-fill', 'colonias-line', 'colonias-label'] as const

/**
 * Capa invisible que siempre está prendida: sirve para saber en qué colonia
 * cae un punto o un clic aunque el usuario haya ocultado las colonias.
 */
export const COLONIA_HIT_LAYER = 'colonias-hit'
const SELECTED_LAYER = 'colonias-selected'

// Color por colonia según su id, así las vecinas casi siempre quedan de distinto tono.
// Tonos suaves sin rojo, amarillo ni verde para no confundirse con los estados del agua.
const coloniaColor: ExpressionSpecification = [
  'match', ['%', ['to-number', ['id']], 8],
  0, '#8fb8de',
  1, '#b7a6d9',
  2, '#9ccfc6',
  3, '#c9b8a6',
  4, '#a9c4e8',
  5, '#d4b3c9',
  6, '#9fb0d9',
  '#b8c4cc',
]

// reports-layer.ts pone el feature-state "estado" en las colonias con reportes vigentes
const tieneEstado: ExpressionSpecification = ['to-boolean', ['feature-state', 'estado']]
const estadoColor: ExpressionSpecification = [
  'match', ['feature-state', 'estado'],
  'no', STATUS_COLORS.no,
  'baja', STATUS_COLORS.baja,
  STATUS_COLORS.ok,
]

/**
 * Colonias (vector tiles de wawhere-api, generados por PostGIS) y el límite de Jalisco.
 * Las colonias con reportes se tiñen con el color de su estado.
 */
export function addBoundaryLayers(map: MapLibreMap): void {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  const apiBase = API_URL || window.location.origin

  map.addSource(COLONIA_SOURCE, {
    type: 'vector',
    tiles: [`${apiBase}/api/tiles/colonias/{z}/{x}/{y}.pbf`],
    // Debe coincidir con MIN_ZOOM / MAX_ZOOM de wawhere-api/app/routes/tiles.py
    minzoom: 9,
    maxzoom: 16,
  })

  map.addLayer(
    {
      id: 'colonias-fill',
      type: 'fill',
      source: COLONIA_SOURCE,
      'source-layer': COLONIA_SOURCE_LAYER,
      paint: {
        'fill-color': ['case', tieneEstado, estadoColor, coloniaColor],
        'fill-opacity': ['case', tieneEstado, 0.38, 0.2],
      },
    },
    firstLabel,
  )

  map.addLayer(
    {
      id: COLONIA_HIT_LAYER,
      type: 'fill',
      source: COLONIA_SOURCE,
      'source-layer': COLONIA_SOURCE_LAYER,
      paint: { 'fill-color': '#000', 'fill-opacity': 0 },
    },
    firstLabel,
  )

  map.addLayer(
    {
      id: 'colonias-line',
      type: 'line',
      source: COLONIA_SOURCE,
      'source-layer': COLONIA_SOURCE_LAYER,
      paint: {
        'line-color': '#6f8296',
        'line-opacity': 0.45,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 15, 1],
      },
    },
    firstLabel,
  )

  // Contorno de la colonia elegida para reportar
  map.addLayer({
    id: SELECTED_LAYER,
    type: 'line',
    source: COLONIA_SOURCE,
    'source-layer': COLONIA_SOURCE_LAYER,
    filter: ['==', ['id'], -1],
    paint: {
      'line-color': '#1d2327',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 3],
    },
  })

  map.addSource('jalisco', { type: 'geojson', data: `${import.meta.env.BASE_URL}jalisco.geojson` })

  map.addLayer(
    {
      id: 'jalisco-line',
      type: 'line',
      source: 'jalisco',
      paint: {
        'line-color': '#1d2327',
        'line-opacity': 0.6,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 3],
        'line-dasharray': [3, 2],
      },
    },
    firstLabel,
  )

  // Nombres de colonia solo de cerca, cuando caben
  map.addLayer({
    id: 'colonias-label',
    type: 'symbol',
    source: COLONIA_SOURCE,
    'source-layer': COLONIA_SOURCE_LAYER,
    minzoom: 14,
    layout: {
      'text-field': ['get', 'nombre'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#4a5866',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5,
    },
  })
}

export function setSelectedColonia(map: MapLibreMap, id: number | null): void {
  map.setFilter(SELECTED_LAYER, ['==', ['id'], id ?? -1])
}

export function toColonia(feature: MapGeoJSONFeature): Colonia | null {
  if (feature.id == null) return null
  return {
    id: Number(feature.id),
    nombre: String(feature.properties?.nombre ?? ''),
    municipio: String(feature.properties?.municipio ?? ''),
  }
}

/**
 * Colonia en un punto, buscada en los tiles que ya están en pantalla: la ubicación
 * exacta no sale del navegador. Si el punto cae en una calle o en un hueco entre
 * polígonos, busca en cuadros cada vez más grandes (a zoom 15, 45 px ≈ 200 m).
 * El punto tiene que estar en pantalla y con los tiles cargados.
 */
export function coloniaAt(map: MapLibreMap, lngLat: LngLatLike): Colonia | null {
  const p = map.project(lngLat)
  const exact = map.queryRenderedFeatures(p, { layers: [COLONIA_HIT_LAYER] })[0]
  if (exact) return toColonia(exact)

  for (const r of [10, 25, 45]) {
    const near = map.queryRenderedFeatures(
      [[p.x - r, p.y - r], [p.x + r, p.y + r]],
      { layers: [COLONIA_HIT_LAYER] },
    )[0]
    if (near) return toColonia(near)
  }
  return null
}