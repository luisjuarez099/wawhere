import { DONUT_ORDER, MIN_SEGMENT_DEG, STATUS_COLORS, donutSize } from './config'
import type { ReportStatus } from './types'

/** Conteos de una colonia o de un grupo, como vienen en /resumen. */
export interface Conteos {
  total: number
  sin_agua: number
  fugas: number
  baja_presion: number
  con_agua: number
}

export interface Segmento {
  status: ReportStatus
  deg: number
}

/**
 * Grados del anillo por estado, en el orden de DONUT_ORDER. Cada estado presente
 * ocupa al menos MIN_SEGMENT_DEG; lo que falta se descuenta en proporción de los
 * demás, así que la suma sigue siendo 360.
 */
export function segmentos(c: Conteos): Segmento[] {
  const presentes = DONUT_ORDER.map(({ key, status }) => ({ status, n: c[key] })).filter((s) => s.n > 0)
  const suma = presentes.reduce((a, s) => a + s.n, 0)
  if (suma === 0) return []

  const segs = presentes.map((s) => ({ status: s.status, deg: (s.n / suma) * 360 }))
  if (segs.length === 1) return segs

  const deficit = segs.reduce((a, s) => a + Math.max(0, MIN_SEGMENT_DEG - s.deg), 0)
  if (deficit === 0) return segs
  const base = segs.reduce((a, s) => a + (s.deg >= MIN_SEGMENT_DEG ? s.deg : 0), 0)
  return segs.map((s) => ({
    status: s.status,
    deg: s.deg < MIN_SEGMENT_DEG ? MIN_SEGMENT_DEG : s.deg - deficit * (s.deg / base),
  }))
}

const NS = 'http://www.w3.org/2000/svg'

function arco(c: number, r: number, inicio: number, fin: number): string {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180
  const x0 = c + r * Math.cos(rad(inicio))
  const y0 = c + r * Math.sin(rad(inicio))
  const x1 = c + r * Math.cos(rad(fin))
  const y1 = c + r * Math.sin(rad(fin))
  const largo = fin - inicio > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${largo} 1 ${x1} ${y1}`
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

/**
 * Dona: centro blanco con el total y un anillo dividido por estado.
 * Se arma con createElementNS y textContent; nada pasa por innerHTML.
 */
export function donutSVG(c: Conteos): SVGSVGElement {
  const { d, grosor } = donutSize(c.total)
  const cx = d / 2
  const r = cx - grosor / 2 - 1.5 // deja un borde blanco de 1.5 px afuera del anillo

  const svg = el('svg', { width: d, height: d, viewBox: `0 0 ${d} ${d}`, 'aria-hidden': 'true' })
  svg.append(el('circle', { cx, cy: cx, r: cx - 0.75, fill: '#fff' }))

  const segs = segmentos(c)
  if (segs.length === 1) {
    // Un arco de 360° no se puede dibujar con path: anillo completo
    svg.append(el('circle', { cx, cy: cx, r, fill: 'none', stroke: STATUS_COLORS[segs[0].status], 'stroke-width': grosor }))
  } else {
    let a = 0
    for (const s of segs) {
      svg.append(el('path', { d: arco(cx, r, a, a + s.deg), fill: 'none', stroke: STATUS_COLORS[s.status], 'stroke-width': grosor }))
      a += s.deg
    }
  }

  const num = el('text', {
    x: cx,
    y: cx,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': Math.round(d * 0.34),
    class: 'donut-num',
  })
  num.textContent = c.total > 99 ? '99+' : String(c.total)
  svg.append(num)
  return svg
}
