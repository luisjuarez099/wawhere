import type { Feature, FeatureCollection, Point } from 'geojson'

export type ReportStatus = 'no' | 'baja' | 'ok'


// Espejo de ReportResponse en wawhere-api/app/schemas/report.py
export interface Report {
  id: string
  status: ReportStatus
  colonia_id: number
  created_at: string
}

// Espejo de ReportCreate: solo la colonia, nunca coordenadas
export interface ReportCreate {
  colonia_id: number
  status: ReportStatus
}

// Propiedades de cada colonia en GET /api/reports/resumen
export interface ColoniaResumenProps {
  colonia_id: number
  nombre: string
  municipio: string
  total: number
  sin_agua: number
  baja_presion: number
  con_agua: number
  estado: ReportStatus // el status con más reportes (en empate, el más grave)
}

// El punto es un punto interior del polígono de la colonia, no la ubicación de nadie
export type ColoniaResumen = Feature<Point, ColoniaResumenProps>
export type ResumenCollection = FeatureCollection<Point, ColoniaResumenProps>

export type RealtimeMessage = { type: 'colonia_update'; feature: ColoniaResumen }

// Colonia tomada de los vector tiles (id, nombre y municipio vienen de la tabla colonias)
export interface Colonia {
  id: number
  nombre: string
  municipio: string
}