// Espejo de ReportResponse en wawhere-api/app/schemas/report.py
export type ReportStatus = 'no' | 'baja' | 'ok'

export interface Report {
  id: string
  latitude: number
  longitude: number
  status: ReportStatus
  colonia: string | null
  created_at: string
}

// Espejo de ReportCreate en wawhere-api/app/schemas/report.py
export interface ReportCreate {
  latitude: number
  longitude: number
  status: ReportStatus
  colonia?: string
}

export type RealtimeMessage = { type: 'new_report'; report: Report }

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}
