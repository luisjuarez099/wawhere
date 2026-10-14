import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'
import { ROTACION_ZONAS_URL } from './api'
import { ZONA_COLORS } from './config'

// Zonas del esquema rotatorio del SIAPA. Empiezan apagadas: se prenden desde el
// panel de racionamiento o desde el botón de capas.

const SOURCE = 'rotacion-zonas'

export const ROTACION_LAYERS = ['rotacion-relleno', 'rotacion-borde', 'rotacion-nombre'] as const

const zonaColor: ExpressionSpecification = [
  'match', ['get', 'zona'],
  ...Object.entries(ZONA_COLORS).flatMap(([zona, color]) => [Number(zona), color]),
  '#5f6b73',
] as unknown as ExpressionSpecification

// feature-state "hoy": las zonas con racionamiento hoy se ven más marcadas
const esHoy: ExpressionSpecification = ['boolean', ['feature-state', 'hoy'], false]

/** Agrega las capas debajo de `beforeId` (los conteos de reportes quedan encima). */
export function addRotacionLayers(map: MapLibreMap, beforeId?: string): void {
  map.addSource(SOURCE, { type: 'geojson', data: ROTACION_ZONAS_URL })

  map.addLayer(
    {
      id: 'rotacion-relleno',
      type: 'fill',
      source: SOURCE,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': zonaColor,
        'fill-opacity': ['case', esHoy, 0.3, 0.1],
      },
    },
    beforeId,
  )

  map.addLayer(
    {
      id: 'rotacion-borde',
      type: 'line',
      source: SOURCE,
      layout: { visibility: 'none', 'line-join': 'round' },
      paint: {
        'line-color': zonaColor,
        'line-width': ['case', esHoy, 3, 1.5],
        // Punteado: es un área de servicio, no un límite como el de las colonias
        'line-dasharray': [3, 2],
      },
    },
    beforeId,
  )

  map.addLayer(
    {
      id: 'rotacion-nombre',
      type: 'symbol',
      source: SOURCE,
      minzoom: 10,
      layout: {
        visibility: 'none',
        // feature-state no se puede usar en layout; "hoy" se nota en el relleno y el borde
        'text-field': ['get', 'nombre'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': zonaColor,
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    },
    beforeId,
  )
}

/** Marca las zonas que hoy tienen racionamiento. */
export function setZonasHoy(map: MapLibreMap, zonas: number[]): void {
  for (const zona of Object.keys(ZONA_COLORS).map(Number)) {
    map.setFeatureState({ source: SOURCE, id: zona }, { hoy: zonas.includes(zona) })
  }
}
