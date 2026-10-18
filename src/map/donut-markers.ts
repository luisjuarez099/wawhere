import type { Point } from 'geojson'
import { Marker } from 'maplibre-gl'
import type { GeoJSONFeature, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { donutSVG, type Conteos } from './donut'
import type { ColoniaResumenProps } from './types'

interface Entrada {
  marker: Marker
  // Se actualiza en cada pasada: cluster_id cambia con cada setData
  feature: GeoJSONFeature
}

const fmtNum = new Intl.NumberFormat('es-MX')
const plural = (n: number, uno: string, varios: string) => `${fmtNum.format(n)} ${n === 1 ? uno : varios}`

// Mismo orden que el anillo (las fugas no se dibujan por ahora)
const PARTES: [keyof Conteos, string, string][] = [
  ['sin_agua', 'sin agua', 'sin agua'],
  ['baja_presion', 'baja presión', 'baja presión'],
  ['con_agua', 'con agua', 'con agua'],
]

/** Solo reportes de agua: el total de la dona no incluye las fugas. */
function conteos(p: Record<string, unknown>): Conteos {
  const n = (k: string) => Number(p[k] ?? 0)
  const sin_agua = n('sin_agua')
  const baja_presion = n('baja_presion')
  const con_agua = n('con_agua')
  return { total: sin_agua + baja_presion + con_agua, sin_agua, fugas: 0, baja_presion, con_agua }
}

/** "5 reportes en Monumental: 3 sin agua, 2 con agua" (el color nunca es la única señal). */
function etiqueta(p: Record<string, unknown>): string {
  const c = conteos(p)
  const desglose = PARTES.filter(([k]) => c[k] > 0)
    .map(([k, uno, varios]) => `${fmtNum.format(c[k])} ${c[k] === 1 ? uno : varios}`)
    .join(', ')
  const reportes = plural(c.total, 'reporte', 'reportes')
  if (p.cluster) {
    return `${reportes} en ${plural(Number(p.point_count), 'colonia', 'colonias')}: ${desglose}. Toca para acercar`
  }
  return `${reportes} en ${String(p.nombre ?? 'la colonia')}: ${desglose}`
}

/**
 * La llave incluye los conteos: si cambian, la dona se regenera. Los grupos usan su
 * coordenada redondeada y no cluster_id, que cambia con cada setData aunque el grupo
 * sea el mismo; así un reporte nuevo no regenera todas las donas.
 */
function llave(f: GeoJSONFeature): string {
  const p = f.properties
  const c = conteos(p)
  const cuenta = `${c.sin_agua}-${c.fugas}-${c.baja_presion}-${c.con_agua}`
  if (p.cluster) {
    const [lng, lat] = (f.geometry as Point).coordinates
    return `c:${lng.toFixed(5)},${lat.toFixed(5)}:${cuenta}`
  }
  return `p:${p.colonia_id}:${cuenta}`
}

/**
 * Donas de reportes como marcadores HTML, sobre los puntos de la fuente agrupada
 * (patrón "HTML clusters" de MapLibre). Las capas de círculos de la fuente quedan
 * transparentes para que la fuente siga cargada y querySourceFeatures responda.
 */
export function initDonutMarkers(
  map: MapLibreMap,
  { source, onColonia }: { source: string; onColonia: (props: ColoniaResumenProps) => void },
) {
  let activos = new Map<string, Entrada>()
  let visible = true
  let pendiente = false

  function crear(feature: GeoJSONFeature): Entrada {
    const p = feature.properties
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'donut'
    const texto = etiqueta(p)
    button.setAttribute('aria-label', texto)
    button.title = texto
    button.append(donutSVG(conteos(p)))

    const entrada: Entrada = { marker: new Marker({ element: button }), feature }
    entrada.marker.setLngLat((feature.geometry as Point).coordinates as [number, number])

    button.addEventListener('click', async (ev) => {
      // Que no llegue al mapa: abriría también la colonia de abajo
      ev.stopPropagation()
      const actual = entrada.feature
      const props = actual.properties
      const center = (actual.geometry as Point).coordinates as [number, number]
      if (props.cluster) {
        let zoom = map.getZoom() + 2
        try {
          zoom = await map.getSource<GeoJSONSource>(source)!.getClusterExpansionZoom(Number(props.cluster_id))
        } catch {
          // El grupo ya no existe (llegó otro setData): se acerca un poco de todos modos
        }
        map.easeTo({ center, zoom })
      } else {
        onColonia(props as ColoniaResumenProps)
      }
    })
    return entrada
  }

  function actualizar(): void {
    pendiente = false
    if (!visible || !map.getSource(source) || !map.isSourceLoaded(source)) return

    const siguientes = new Map<string, Entrada>()
    for (const f of map.querySourceFeatures(source)) {
      if (f.geometry.type !== 'Point') continue
      // Colonia sin reportes de agua (solo fugas): no tiene dona
      if (conteos(f.properties).total === 0) continue
      const k = llave(f)
      if (siguientes.has(k)) continue // querySourceFeatures repite features entre tiles
      const previa = activos.get(k)
      if (previa) previa.feature = f
      siguientes.set(k, previa ?? crear(f))
    }
    for (const [k, e] of siguientes) if (!activos.has(k)) e.marker.addTo(map)
    for (const [k, e] of activos) if (!siguientes.has(k)) e.marker.remove()
    activos = siguientes
  }

  // 'render' se dispara muchas veces por segundo: se agrupa en un frame
  const programar = () => {
    if (pendiente) return
    pendiente = true
    requestAnimationFrame(actualizar)
  }
  map.on('render', programar)
  map.on('idle', programar)

  return {
    setVisible(on: boolean): void {
      visible = on
      if (on) {
        programar()
      } else {
        activos.forEach((e) => e.marker.remove())
        activos.clear()
      }
    },
  }
}
