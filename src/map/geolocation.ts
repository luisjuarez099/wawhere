import { ZMG_MAX_BOUNDS } from './config'

export class LocationError extends Error {}

/** Ubicación del usuario como promesa, con mensajes listos para mostrar. */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('Tu navegador no permite obtener tu ubicación.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        reject(
          new LocationError(
            err.code === err.PERMISSION_DENIED
              ? 'Necesitamos tu ubicación para colocar el reporte. Actívala en los permisos del navegador.'
              : 'No pudimos obtener tu ubicación. Intenta de nuevo.',
          ),
        )
      },
      // Acepta una ubicación de hasta 1 minuto para no esperar al GPS en cada reporte
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  })
}

export function isInsideZmg(lng: number, lat: number): boolean {
  const [[west, south], [east, north]] = ZMG_MAX_BOUNDS
  return lng >= west && lng <= east && lat >= south && lat <= north
}
