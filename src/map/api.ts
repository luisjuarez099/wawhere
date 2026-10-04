import { API_URL } from './config'
import type { ColoniaResumen, RealtimeMessage, Report, ReportCreate, ResumenCollection } from './types'

/** Error HTTP con el status, para mostrar un mensaje distinto según el caso (422, 429…). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Conteos por colonia de los reportes vigentes. Es poco dato, así que se pide completo. */
export async function fetchResumen(signal?: AbortSignal): Promise<ResumenCollection> {
  const res = await fetch(`${API_URL}/api/reports/resumen`, { signal })
  if (!res.ok) throw new ApiError(res.status, `GET /api/reports/resumen → ${res.status}`)
  return res.json()
}

export async function createReport(body: ReportCreate): Promise<Report> {
  const res = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, `POST /api/reports → ${res.status}`)
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