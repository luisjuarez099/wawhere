import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { COLONIA_SOURCE, COLONIA_SOURCE_LAYER } from './boundaries-layer'
import { estadoAgua } from './config'
import type { ResumenCollection } from './types'

/** Fuente agrupada de los conteos por colonia; las donas (donut-markers.ts) la leen. */
export const RESUMEN_SOURCE = 'resumen'
const SOURCE = RESUMEN_SOURCE
const HEAT_SOURCE = 'resumen-calor'

const CLUSTER_LAYER = 'resumen-grupo'

/**
 * Capas que prende/apaga "Número de reportes", junto con las donas. Son círculos
 * transparentes: no se ven, pero mantienen cargada la fuente para las donas.
 */
export const RESUMEN_LAYERS = [CLUSTER_LAYER, 'resumen-circulo'] as const

/** Capa que prende/apaga "Mapa de calor". Va debajo de los círculos. */
export const HEAT_LAYERS = ['resumen-calor'] as const

// Hasta este zoom las colonias cercanas se agrupan en un solo círculo
const CLUSTER_MAX_ZOOM = 13

const sinGrupo: ExpressionSpecification = ['!', ['has', 'point_count']]
const esGrupo: ExpressionSpecification = ['has', 'point_count']

/**
 * Reportes por colonia en tres capas, todas sobre el punto interior de cada
 * colonia (nunca la ubicación de nadie):
 * - Mapa de calor de los reportes de problemas de agua (sin agua y baja presión; sin fugas por ahora).
 * - Grupos: a zoom bajo, las colonias cercanas se juntan y suman sus conteos.
 * - Punto por colonia al acercarse. Grupos y colonias se dibujan como donas con
 *   el desglose por estado (donut-markers.ts); las fugas cuentan como un reporte más.
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
        ['+', ['get', 'sin_agua'], ['*', 0.5, ['get', 'baja_presion']]],
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

  // Grupos y colonias se dibujan como donas HTML (donut-markers.ts). Estas capas son
  // transparentes y sin eventos: solo mantienen cargada la fuente, porque
  // querySourceFeatures no responde si ninguna capa visible la usa.
  const invisible = { 'circle-radius': 1, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } as const
  map.addLayer({ id: CLUSTER_LAYER, type: 'circle', source: SOURCE, filter: esGrupo, paint: invisible })
  map.addLayer({ id: 'resumen-circulo', type: 'circle', source: SOURCE, filter: sinGrupo, paint: invisible })

  // Colonias teñidas ahora mismo, para quitar el color a las que ya no tienen reportes
  const tenidas = new Set<number>()

  const syncTinte = (data: ResumenCollection) => {
    const siguientes = new Set<number>()
    for (const f of data.features) {
      const id = f.properties.colonia_id
      // Solo reportes de agua tiñen la colonia: una colonia con solo fugas queda sin color
      const p = f.properties
      const estado = estadoAgua(p.sin_agua, p.baja_presion, p.con_agua)
      if (!estado) continue
      siguientes.add(id)
      map.setFeatureState(
        { source: COLONIA_SOURCE, sourceLayer: COLONIA_SOURCE_LAYER, id },
        { estado },
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

