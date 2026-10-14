import { API_URL } from './config'
import type { ColoniaBusqueda, ColoniaComentarios, ColoniaDetalle, ColoniaResumen, RealtimeMessage, Report, ReportCreate, ResumenCollection, Rotacion, StatsResponse } from './types'

/** Error HTTP con el status y el detail, para mostrar un mensaje distinto según el caso (422, 429…). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message)
  }
}

/** Conteos por colonia de los reportes vigentes. Es poco dato, así que se pide completo. */
export async function fetchResumen(signal?: AbortSignal): Promise<ResumenCollection> {
  const res = await fetch(`${API_URL}/api/reports/resumen`, { signal })
  if (!res.ok) throw new ApiError(res.status, `GET /api/reports/resumen → ${res.status}`)
  return res.json()
}

/** Totales de reportes; el mapa usa el histórico (los vigentes los calcula del resumen). */
export async function fetchStats(signal?: AbortSignal): Promise<StatsResponse> {
  const res = await fetch(`${API_URL}/api/reports/stats`, { signal })
  if (!res.ok) throw new ApiError(res.status, `GET /api/reports/stats → ${res.status}`)
  return res.json()
}

/** Calendario del esquema rotatorio del SIAPA, con el día de hoy. */
export async function fetchRotacion(signal?: AbortSignal): Promise<Rotacion> {
  const res = await fetch(`${API_URL}/api/rotacion`, { signal })
  if (!res.ok) throw new ApiError(res.status, `GET /api/rotacion → ${res.status}`)
  return res.json()
}

/** Polígonos de las zonas; MapLibre los pide directo como fuente GeoJSON. */
export const ROTACION_ZONAS_URL = `${API_URL}/api/rotacion/zonas.geojson`

/** Detalle de una colonia: suministro, calidad y último reporte (solo reportes activos). */
export async function getColoniaDetalle(id: number, signal?: AbortSignal): Promise<ColoniaDetalle> {
  const res = await fetch(`${API_URL}/api/colonias/${id}`, { signal })
  if (!res.ok) throw new ApiError(res.status, `GET /api/colonias/${id} → ${res.status}`)
  return res.json()
}

/** Colonias por nombre. `cerca` es el centro del mapa (no la ubicación del usuario) para ordenar los homónimos. */
export async function searchColonias(
  q: string,
  cerca: [number, number],
  signal?: AbortSignal,
): Promise<ColoniaBusqueda[]> {
  const params = new URLSearchParams({ q, limit: '8', lng: cerca[0].toFixed(3), lat: cerca[1].toFixed(3) })
  const res = await fetch(`${API_URL}/api/colonias?${params}`, { signal })
  if (!res.ok) throw new ApiError(res.status, `GET /api/colonias?q= → ${res.status}`)
  return res.json()
}

/** Comentarios más viejos que `antes` (el created_at del último que ya se mostró). */
export async function getColoniaComentarios(
  id: number,
  antes: string,
  signal?: AbortSignal,
): Promise<ColoniaComentarios> {
  const params = new URLSearchParams({ antes, limit: '20' })
  const res = await fetch(`${API_URL}/api/colonias/${id}/comentarios?${params}`, { signal })
  if (!res.ok) throw new ApiError(res.status, `GET /api/colonias/${id}/comentarios → ${res.status}`)
  return res.json()
}

export async function createReport(body: ReportCreate): Promise<Report> {
  const res = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // detail string → colonia inválida; detail array → validación de campos (Pydantic)
    const detail = await res.json().then((b) => b?.detail, () => undefined)
    throw new ApiError(res.status, `POST /api/reports → ${res.status}`, detail)
  }
  return res.json()
}

function realtimeUrl(): string {
  const base = API_URL || window.location.origin
  return base.replace(/^http/, 'ws') + '/api/reports/ws'
}

interface RealtimeHandlers {
  // Conteo actualizado de una colonia después de que alguien reporta
  onColoniaUpdate: (feature: ColoniaResumen) => void
  // Se llama al (re)conectar: lo que llegó mientras estaba caído se perdió, hay que refrescar
  onReconnect: () => void
}

/**
 * WebSocket con reconexión (backoff exponencial). Se cierra cuando la pestaña
 * está oculta para no gastar batería ni conexiones del servidor.
 */
export function connectRealtime({ onColoniaUpdate, onReconnect }: RealtimeHandlers): () => void {
  let ws: WebSocket | null = null
  let retry = 0
  let retryTimer: number | undefined
  let firstOpen = true
  let stopped = false

  const open = () => {
    if (stopped || ws || document.hidden) return
    ws = new WebSocket(realtimeUrl())

    ws.onopen = () => {
      retry = 0
      if (!firstOpen) onReconnect()
      firstOpen = false
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as RealtimeMessage
        if (msg.type === 'colonia_update' && msg.feature) onColoniaUpdate(msg.feature)
      } catch {
        // mensaje inválido: se ignora
      }
    }

    ws.onclose = () => {
      ws = null
      if (stopped || document.hidden) return
      const delay = Math.min(30_000, 1_000 * 2 ** retry++)
      retryTimer = window.setTimeout(open, delay)
    }
  }

  const close = () => {
    window.clearTimeout(retryTimer)
    ws?.close()
    ws = null
  }

  const onVisibility = () => {
    if (document.hidden) {
      close()
    } else {
      firstOpen = false // al volver, siempre refrescar
      open()
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  open()

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    close()
  }
}