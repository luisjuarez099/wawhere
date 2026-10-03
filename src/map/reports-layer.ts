import { Popup } from 'maplibre-gl'
import type {
  ExpressionSpecification,
  GeoJSONSource,
  HeatmapLayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { STATUS_COLORS, STATUS_LABELS } from './config'
import type { ReportProps } from './report-store'
import type { ReportStatus } from './types'

const SOURCE = 'reports'

/** Capas que prende/apaga cada control. */
export const LAYERS = {
  heatmap: ['heat-baja', 'heat-no'],
  points: ['report-points'],
} as const

/**
 * Rampa de color de un heatmap: transparente donde no hay reportes y más
 * intenso entre más reportes hay juntos. `rgb` es el color base, `deep` el del centro.
 */
function heatColor(rgb: string, deep: string): ExpressionSpecification {
  return [
    'interpolate', ['linear'], ['heatmap-density'],
    0, `rgba(${rgb}, 0)`,
    0.15, `rgba(${rgb}, 0.25)`,
    0.4, `rgba(${rgb}, 0.5)`,
    0.7, `rgba(${rgb}, 0.7)`,
    1, `rgba(${deep}, 0.85)`,
  ]
}

function heatmapLayer(id: string, status: ReportStatus, color: ExpressionSpecification): HeatmapLayerSpecification {
  return {
    id,
    type: 'heatmap',
    source: SOURCE,
    filter: ['==', ['get', 'status'], status],
    paint: {
      'heatmap-weight': 1,
      // A más zoom, cada reporte pesa más para que una colonia con pocos reportes se siga viendo
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 1.6],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 14, 15, 36],
      // De cerca se baja la opacidad para que se lean las calles y los puntos
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.85, 17, 0.45],
      'heatmap-color': color,
    },
  }
}

/**
 * Reportes como una sola fuente GeoJSON (sin clustering: el heatmap necesita
 * cada reporte por separado). Todo se dibuja en WebGL, así que aguanta miles de puntos.
 */
export function addReportsLayer(map: MapLibreMap): (data: FeatureCollection<Point, ReportProps>) => void {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  // Los heatmaps van debajo de los nombres de calles y colonias del mapa base
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id

  // Amarillo primero y rojo encima: "sin agua" es lo más importante de ver
  map.addLayer(heatmapLayer('heat-baja', 'baja', heatColor('229, 165, 10', '204, 112, 0')), firstLabel)
  map.addLayer(heatmapLayer('heat-no', 'no', heatColor('217, 59, 59', '150, 0, 0')), firstLabel)

  map.addLayer({
    id: 'report-points',
    type: 'circle',
    source: SOURCE,
    paint: {
      'circle-color': ['match', ['get', 'status'],
        'no', STATUS_COLORS.no,
        'baja', STATUS_COLORS.baja,
        STATUS_COLORS.ok,
      ],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 13, 5, 16, 9],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 2],
      'circle-stroke-color': '#fff',
    },
  })

  bindInteractions(map)

  // Agrupa varias actualizaciones en un solo setData por frame
  const source = map.getSource<GeoJSONSource>(SOURCE)!
  let pending: FeatureCollection<Point, ReportProps> | null = null
  return (data) => {
    if (!pending) requestAnimationFrame(() => {
      if (pending) source.setData(pending)
      pending = null
    })
    pending = data
  }
}

export function setLayersVisible(map: MapLibreMap, ids: readonly string[], visible: boolean): void {
  for (const id of ids) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

function bindInteractions(map: MapLibreMap): void {
  const popup = new Popup({ closeButton: false, offset: 10, maxWidth: '240px' })

  map.on('click', 'report-points', (e) => {
    const feature = e.features?.[0]
    if (!feature) return
    const props = feature.properties as ReportProps
    popup
      .setLngLat((feature.geometry as Point).coordinates as [number, number])
      .setDOMContent(popupContent(props))
      .addTo(map)
  })

  map.on('mouseenter', 'report-points', () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'report-points', () => (map.getCanvas().style.cursor = ''))
}

// DOM con textContent: "colonia" viene del usuario, nunca va como HTML
function popupContent({ status, colonia, created_at }: ReportProps): HTMLElement {
  const el = document.createElement('div')
  el.className = 'report-popup'

  const title = document.createElement('strong')
  title.textContent = STATUS_LABELS[status] ?? status
  title.style.color = STATUS_COLORS[status]
  el.append(title)

  if (colonia) {
    const p = document.createElement('p')
    p.textContent = colonia
    el.append(p)
  }

  const time = document.createElement('time')
  time.dateTime = created_at
  time.textContent = timeAgo(created_at)
  el.append(time)

  return el
}

const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  return rtf.format(Math.round(minutes / 60), 'hour')
}
