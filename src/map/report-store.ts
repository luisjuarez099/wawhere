import type { FeatureCollection, Point } from 'geojson'
import type { Report, ReportStatus } from './types'

export interface ReportProps {
  id: string
  status: ReportStatus
  colonia: string
  created_at: string
}

/** Reportes conocidos por id. Se fusionan respuestas HTTP y mensajes del WebSocket. */
export class ReportStore {
  private reports = new Map<string, Report>()

  constructor(private expiryMs: number) {}

  upsert(list: Report[]): void {
    for (const r of list) this.reports.set(r.id, r)
  }

  /** Elimina los reportes vencidos. Devuelve true si cambió algo. */
  prune(now = Date.now()): boolean {
    const before = this.reports.size
    for (const [id, r] of this.reports) {
      if (now - Date.parse(r.created_at) > this.expiryMs) this.reports.delete(id)
    }
    return this.reports.size !== before
  }

  toGeoJSON(): FeatureCollection<Point, ReportProps> {
    const features = []
    for (const r of this.reports.values()) {
      features.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [r.longitude, r.latitude] },
        properties: {
          id: r.id,
          status: r.status,
          colonia: r.colonia ?? '',
          created_at: r.created_at,
        },
      })
    }
    return { type: 'FeatureCollection', features }
  }
}
