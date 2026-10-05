import type { Map as MapLibreMap } from 'maplibre-gl'

export interface Basemap {
  id: string
  label: string
  /** Sin tiles = el estilo vectorial base (Positron de OpenFreeMap). */
  tiles?: string[]
  attribution?: string
  maxzoom?: number
  /** Deja visibles los nombres de calles del estilo base encima del raster. */
  labels?: boolean
}

export const BASEMAPS: Basemap[] = [
  { id: 'claro', label: 'Claro' },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxzoom: 19,
  },
  {
    id: 'satelite',
    label: 'Satélite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
    maxzoom: 19,
    labels: true,
  },
  // {
  //   id: 'topo',
  //   label: 'Relieve',
  //   tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
  //   attribution:
  //     '© <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)',
  //   maxzoom: 17,
  // },
]

export const DEFAULT_BASEMAP = BASEMAPS[0].id

const rasterLayerId = (id: string) => `basemap-${id}`

/**
 * Agrega los mapas base raster (ocultos) debajo de las etiquetas del estilo y
 * devuelve una función para cambiar de mapa base. Llamar en `load`, antes de
 * agregar las capas propias, para que los raster queden debajo de ellas.
 */
export function addBasemaps(map: MapLibreMap): (id: string) => void {
  const styleLayers = map.getStyle().layers
  const firstLabel = styleLayers.find((l) => l.type === 'symbol')?.id
  // Capas del estilo base: se ocultan cuando hay un raster encima
  const baseLayers = styleLayers.filter((l) => l.type !== 'background')

  for (const b of BASEMAPS) {
    if (!b.tiles) continue
    map.addSource(rasterLayerId(b.id), {
      type: 'raster',
      tiles: b.tiles,
      tileSize: 256,
      maxzoom: b.maxzoom,
      attribution: b.attribution,
    })
    map.addLayer(
      {
        id: rasterLayerId(b.id),
        type: 'raster',
        source: rasterLayerId(b.id),
        layout: { visibility: 'none' },
      },
      firstLabel,
    )
  }

  return (id: string) => {
    const active = BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0]
    for (const b of BASEMAPS) {
      if (b.tiles) {
        map.setLayoutProperty(rasterLayerId(b.id), 'visibility', b.id === active.id ? 'visible' : 'none')
      }
    }
    for (const l of baseLayers) {
      const show = !active.tiles || (active.labels && l.type === 'symbol')
      map.setLayoutProperty(l.id, 'visibility', show ? 'visible' : 'none')
    }
  }
}
