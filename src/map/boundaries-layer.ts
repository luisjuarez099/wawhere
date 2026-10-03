import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'
import { API_URL } from './config'

/** Capas que prende/apaga el control 🏘️. */
export const COLONIA_LAYERS = ['colonias-fill', 'colonias-line', 'colonias-label'] as const

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

/**
 * Colonias (vector tiles de wawhere-api, generados por PostGIS) y el límite de Jalisco.
 * Van debajo de los heatmaps y de los nombres del mapa base: son contexto, no protagonistas.
 */
export function addBoundaryLayers(map: MapLibreMap): void {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  const apiBase = API_URL || window.location.origin

  map.addSource('colonias', {
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
      source: 'colonias',
      'source-layer': 'colonias',
      paint: {
        'fill-color': coloniaColor,
        'fill-opacity': 0.2,
      },
    },
    firstLabel,
  )

  map.addLayer(
    {
      id: 'colonias-line',
      type: 'line',
      source: 'colonias',
      'source-layer': 'colonias',
      paint: {
        'line-color': '#6f8296',
        'line-opacity': 0.45,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 15, 1],
      },
    },
    firstLabel,
  )

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
    source: 'colonias',
    'source-layer': 'colonias',
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
