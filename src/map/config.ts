import type { ReportStatus } from './types'

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

// Mismos colores que --red / --yellow / --green en tokens.css
export const STATUS_COLORS: Record<ReportStatus, string> = {
  no: '#d93b3b',
  baja: '#e5a50a',
  ok: '#2e9a5a',
}

export const STATUS_LABELS: Record<ReportStatus, string> = {
  no: 'Sin agua',
  baja: 'Baja presión',
  ok: 'Con agua',
}
