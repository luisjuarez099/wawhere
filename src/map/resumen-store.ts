import type { ColoniaResumen, ResumenCollection } from './types'

/**
 * Conteos por colonia. Se reemplaza completo con cada GET /resumen y se
 * actualiza colonia por colonia con los mensajes del WebSocket.
 * El vencimiento lo resuelve la API: al volver a pedir el resumen, las
 * colonias sin reportes vigentes ya no vienen.
 */
export class ResumenStore {
    private byId = new Map<number, ColoniaResumen>()

    replaceAll(data: ResumenCollection): void {
        this.byId = new Map(data.features.map((f) => [f.properties.colonia_id, f]))
    }

    upsert(feature: ColoniaResumen): void {
        this.byId.set(feature.properties.colonia_id, feature)
    }

    get(coloniaId: number): ColoniaResumen | undefined {
        return this.byId.get(coloniaId)
    }

    toGeoJSON(): ResumenCollection {
        return { type: 'FeatureCollection', features: [...this.byId.values()] }
    }
}