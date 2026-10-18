import type { ReportQuality, ReportStatus } from './types'

// Vacío = mismo origen (en dev lo resuelve el proxy de Vite)
export const API_URL: string = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

// OpenFreeMap: tiles vectoriales de OSM, gratis y sin API key
export const MAP_STYLE_URL: string =
  import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron'

// Debe coincidir con REPORT_EXPIRY_HOURS del backend
export const REPORT_EXPIRY_MS = Number(import.meta.env.VITE_REPORT_EXPIRY_HOURS || 24) * 3_600_000

// Hasta dónde se puede mover el mapa: todo Jalisco con un margen
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-106.6, 18.3],
  [-100.6, 23.4],
]
export const MAP_MIN_ZOOM = 6

// Zona Metropolitana de Guadalajara (vista inicial y zona donde se puede reportar)
export const ZMG_CENTER: [number, number] = [-103.35, 20.67]
export const ZMG_ZOOM = 11
export const ZMG_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-104.2, 20.1],
  [-102.5, 21.2],
]

// Mismos colores que --red / --yellow / --green / --cyan en tokens.css
export const STATUS_COLORS: Record<ReportStatus, string> = {
  no: '#d93b3b',
  baja: '#e5a50a',
  ok: '#2e9a5a',
  fuga: '#0b7fae',
}

export const STATUS_LABELS: Record<ReportStatus, string> = {
  no: 'Sin agua',
  baja: 'Baja presión',
  ok: 'Con agua',
  fuga: 'Fuga de agua',
}

// ─── Donas de reportes ───

/**
 * Conteo por estado de agua en /resumen. Orden de la dona: de más grave a menos grave, desde las 12.
 * Las fugas no van aquí: por ahora solo se cuentan aparte en el panel.
 */
export const DONUT_ORDER = [
  { key: 'sin_agua', status: 'no' },
  { key: 'baja_presion', status: 'baja' },
  { key: 'con_agua', status: 'ok' },
] as const satisfies readonly { key: string; status: ReportStatus }[]

/**
 * Estado dominante de una colonia considerando solo reportes de agua. Empate: el más grave.
 * Devuelve null si no hay reportes de agua (una colonia solo con fugas no se tiñe).
 */
export function estadoAgua(no: number, baja: number, ok: number): ReportStatus | null {
  if (no + baja + ok === 0) return null
  if (no >= baja && no >= ok) return 'no'
  if (baja >= ok) return 'baja'
  return 'ok'
}

// Cada estado presente ocupa al menos esto del anillo, para que ninguno desaparezca
export const MIN_SEGMENT_DEG = 6

/** Diámetro y grosor del anillo según el total de reportes. */
export function donutSize(total: number): { d: number; grosor: number } {
  if (total >= 100) return { d: 58, grosor: 8 }
  if (total >= 20) return { d: 50, grosor: 7 }
  if (total >= 5) return { d: 42, grosor: 6 }
  return { d: 34, grosor: 5 }
}

// Zonas del esquema rotatorio: paleta propia (no la del SIAPA) que no se confunde
// con los colores de estado (verde, amarillo, rojo, cian) ni con el mapa de calor
export const ZONA_COLORS: Record<number, string> = {
  1: '#3f6e8c',
  2: '#a1572f',
  3: '#5b5fc7',
  4: '#8c6d31',
  5: '#c2448a',
  6: '#5f6b73',
  7: '#7a4fa3',
}

// 1 = lunes ... 7 = domingo (como isoweekday en la API)
export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** "martes, jueves y domingo" */
export function listaDias(dias: number[]): string {
  const nombres = dias.map((d) => DIAS[d - 1])
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : (nombres[0] ?? '')
}

// Orden en que se muestran los chips de calidad: problemas del agua
export const QUALITY_ORDER: ReportQuality[] = ['mal_olor', 'turbia', 'sedimentos', 'otro']

// Agua en buenas condiciones: con "Con agua" o "Baja presión", y no junto con un problema
export const QUALITY_BUENA: ReportQuality[] = ['limpia', 'cristalina', 'sin_olor']

export const QUALITY_LABELS: Record<ReportQuality, string> = {
  mal_olor: 'Mal olor',
  turbia: 'Turbia',
  sedimentos: 'Sedimentos o color extraño',
  otro: 'Otro',
  limpia: 'Limpia',
  cristalina: 'Cristalina',
  sin_olor: 'Sin olor',
}

// Deben coincidir con max_length en wawhere-api/app/schemas/report.py
export const QUALITY_OTHER_MAX = 80
export const COMMENT_MAX = 280
