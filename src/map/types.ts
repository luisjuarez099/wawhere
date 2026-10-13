import type { Feature, FeatureCollection, Point } from 'geojson'

export type ReportStatus = 'no' | 'baja' | 'ok' | 'fuga'

// Mismos valores que QualityEnum en wawhere-api/app/schemas/report.py
export type ReportQuality = 'mal_olor' | 'turbia' | 'sedimentos' | 'otro'

// Espejo de ReportResponse en wawhere-api/app/schemas/report.py
export interface Report {
  id: string
  status: ReportStatus
  colonia_id: number
  quality: ReportQuality[]
  created_at: string
}

// Espejo de ReportCreate: solo la colonia, nunca coordenadas
export interface ReportCreate {
  colonia_id: number
  status: ReportStatus
  quality?: ReportQuality[]
  quality_other?: string
  comment?: string
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
  fugas: number
  estado: ReportStatus // el status con más reportes (en empate, el más grave)
}

// El punto es un punto interior del polígono de la colonia, no la ubicación de nadie
export type ColoniaResumen = Feature<Point, ColoniaResumenProps>
export type ResumenCollection = FeatureCollection<Point, ColoniaResumenProps>

export type RealtimeMessage = { type: 'colonia_update'; feature: ColoniaResumen }

// Colonia tomada de los vector tiles (id, nombre, municipio y cp vienen de la tabla colonias)
export interface Colonia {
  id: number
  nombre: string
  municipio: string
  cp: string // código postal; vacío si la colonia no lo tiene
}
// Cada resultado de GET /api/colonias?q=: datos de la colonia y su caja [oeste, sur, este, norte]
export interface ColoniaBusqueda {
  id: number
  nombre: string
  municipio: string
  cp: string | null
  bbox: [number, number, number, number]
}

// Comentario público de un reporte (correos y teléfonos ya vienen ocultos)
export interface ColoniaComentario {
  id: string
  status: ReportStatus
  quality_other: string | null
  comment: string | null
  created_at: string
}

// GET /api/reports/stats: totales vigentes y el histórico
export interface StatsResponse {
  total: number
  sin_agua: number
  baja_presion: number
  con_agua: number
  fugas: number
  historico: number // reportes de suministro desde el inicio (sin fugas)
}

// Respuesta de GET /api/colonias/{id}: conteos de los reportes activos de una colonia
export interface ColoniaDetalle {
  colonia_id: number
  nombre: string
  municipio: string
  cp: string | null
  ventana_horas: number
  total: number
  status: Record<ReportStatus, number>
  status_dominante: ReportStatus | null // null si no hay reportes o hay empate
  quality: Record<ReportQuality, number>
  quality_total: number // reportes con al menos un problema
  ultimo_reporte: string | null // UTC
  comentarios?: ColoniaComentario[] // primera página, del más reciente al más viejo
  comentarios_total?: number
  comentarios_hay_mas?: boolean // el resto se pide con getColoniaComentarios
}

// GET /api/colonias/{id}/comentarios: la siguiente página de comentarios
export interface ColoniaComentarios {
  comentarios: ColoniaComentario[]
  hay_mas: boolean
}
