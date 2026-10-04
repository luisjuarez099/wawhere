# wawhere

Mapa comunitario del estado del servicio de agua en la Zona Metropolitana de Guadalajara (ZMG). Los vecinos reportan cómo está el agua en su colonia (**sin agua**, **baja presión** o **con agua**) y el mapa muestra cuántos reportes hay en cada colonia en las últimas horas.

Es gratis, no pide registro y los reportes son anónimos. Está en fase de pruebas.

Sitio: [wawhere.com.mx](https://wawhere.com.mx) · Mapa: [wawhere.com.mx/mapa](https://wawhere.com.mx/mapa/)

---

## Finalidad

Saber rápido si el problema de agua es solo en tu casa o en toda tu colonia, y ver qué zonas de la ciudad están afectadas en este momento.

- Es **informativo y comunitario**. No tiene postura política ni busca evaluar a ninguna dependencia u organismo operador.
- No sustituye los canales oficiales para reportar fugas o fallas. Es una vista de lo que reportan los vecinos.
- Un reporte aislado se muestra, pero no confirma un corte. Mientras más vecinos de una misma colonia reporten, más confiable es la información.

## Cómo funciona

1. La persona abre el mapa y toca **Sin agua**, **Baja presión** o **Con agua**.
2. El navegador averigua en qué colonia está, de una de dos formas:
   - **Con su ubicación (GPS):** se usa solo dentro del navegador para encontrar la colonia en el mapa. Las coordenadas no se envían al servidor.
   - **Tocando su colonia en el mapa**, sin compartir ubicación.
3. Al servidor solo llegan dos datos: el número de colonia y el estado del agua.
4. El mapa de todas las personas conectadas se actualiza al instante con el nuevo conteo de esa colonia.
5. Los reportes vencen a las 24 horas y se borran.

## Qué información obtenemos

| Se guarda                                           | No se guarda                      |
| --------------------------------------------------- | --------------------------------- |
| Colonia del reporte (su id en la tabla de colonias) | Coordenadas o ubicación exacta    |
| Estado del agua: `no`, `baja` u `ok`                | Nombre, correo, teléfono o cuenta |
| Fecha y hora del reporte                            | Dirección o calle                 |

**Qué se publica:** solo conteos por colonia. Por cada colonia con reportes vigentes, el mapa muestra el total y el desglose (sin agua, baja presión, con agua). Nunca se publican reportes individuales ni su hora exacta.

**Cuánto tiempo:** 24 horas (`REPORT_EXPIRY_HOURS`). Después, un proceso automático borra los reportes de la base de datos.

**Otros datos técnicos, para ser transparentes:**

- Como cualquier sitio web, el servidor recibe la dirección IP de quien hace una petición. La API la usa para limitar la cantidad de reportes seguidos (rate limiting) y no la guarda junto con los reportes.
- El sitio usa **Google Analytics** para medir visitas, y carga tipografías desde **Google Fonts**.

## Capas del mapa y sus fuentes

| Capa                      | Qué muestra                                                                                              | Fuente                                                                                                                                                                        | Cómo llega al mapa                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mapa base**             | Calles, nombres de lugares, relieve urbano                                                               | [OpenStreetMap](https://www.openstreetmap.org/copyright) (© colaboradores de OSM, licencia ODbL), servido por [OpenFreeMap](https://openfreemap.org) con el estilo _positron_ | Tiles vectoriales directo desde OpenFreeMap, sin pasar por la API                                                                                                                                          |
| **Colonias** 🏘️           | Polígonos y nombres de las colonias de Jalisco                                                           | Instituto de Información Estadística y Geográfica de Jalisco ([IIEG](https://iieg.gob.mx)), capa de colonias con marco INE 2024. 6,624 polígonos                              | El script `scripts/load_colonias.sh` (repo `wawhere-api`) descarga el shapefile, lo convierte de UTM 13N a WGS84 con `ogr2ogr` y lo carga en PostGIS. La API lo sirve como vector tiles (MVT) en zoom 9–16 |
| **Límite de Jalisco**     | Contorno punteado del estado                                                                             | _Fuente por confirmar_                                                                                                                                                        | Archivo estático `public/jalisco.geojson`                                                                                                                                                                  |
| **Conteo por colonia** 🔢 | Círculo con el número de reportes vigentes, del color del estado más reportado (en empate, el más grave) | Reportes de los vecinos                                                                                                                                                       | `GET /api/reports/resumen` y actualizaciones por WebSocket                                                                                                                                                 |
| **Colonias coloreadas**   | La colonia completa se pinta del color de su estado                                                      | Reportes de los vecinos, sobre la capa de colonias                                                                                                                            | `feature-state` de MapLibre sobre los tiles de colonias                                                                                                                                                    |

El círculo de cada colonia se dibuja en un punto interior de su polígono (`ST_PointOnSurface`). Es un punto fijo de la colonia, no la ubicación de quien reportó.

**Zona de reportes:** se acepta cualquier colonia de los municipios de la ZMG. La lista está en `ZMG_MUNICIPIOS`, en `wawhere-api/app/services/report_service.py`. El mapa se puede recorrer por todo Jalisco, pero solo se puede reportar dentro de la ZMG.

## Cómo está construido

```
┌──────────────────────────┐        ┌───────────────────────────┐        ┌──────────────────────────┐
│  wawhere (este repo)     │  HTTP  │  wawhere-api (repo aparte)│  SQL   │  PostgreSQL + PostGIS    │
│  Vite + TS + MapLibre    │ ─────▶ │  FastAPI + SQLAlchemy     │ ─────▶ │                          │
│  servido por nginx       │ ◀───── │  async (asyncpg)          │ ◀───── │  tablas: reports,        │
│                          │   WS   │  + APScheduler            │        │          colonias        │
└────────────┬─────────────┘        └───────────────────────────┘        └──────────────────────────┘
             │ tiles del mapa base
             ▼
      OpenFreeMap (OSM)
```

- **Frontend (este repo):** sitio estático con Vite, TypeScript y MapLibre GL JS. No guarda nada en servidor. Ubica la colonia del usuario consultando los tiles de colonias que ya tiene en pantalla.
- **API (`wawhere-api`):** FastAPI con Python 3.12. Es la única que habla con la base de datos. Valida la colonia, guarda el reporte, calcula los conteos y avisa por WebSocket.
- **Base de datos:** PostgreSQL con PostGIS (imagen `postgis/postgis:17-3.5`). PostGIS genera los vector tiles de colonias y el punto interior de cada colonia.
- **Infraestructura:** VPS propio con Easypanel. Frontend y API corren en contenedores Docker separados.

### Endpoints

| Endpoint                                  | Quién lo usa                           | Qué hace                                                                                                                                          |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/reports/resumen`                | `fetchResumen`, al cargar y cada 2 min | GeoJSON con un punto por colonia y sus conteos vigentes                                                                                           |
| `POST /api/reports`                       | `createReport`, al tocar un botón      | Body: `{ colonia_id, status }`. Responde `201`, `422` si la colonia no existe o está fuera de la ZMG, y `429` si hay demasiados reportes seguidos |
| `WS /api/reports/ws`                      | `connectRealtime`                      | Envía `{ type: 'colonia_update', feature }` con el conteo nuevo de una colonia cada vez que alguien reporta                                       |
| `GET /api/tiles/colonias/{z}/{x}/{y}.pbf` | Fuente vectorial de MapLibre           | Polígonos de colonias en MVT, zoom 9–16, con caché de 1 día                                                                                       |
| `GET /api/reports/stats`                  | Disponible, el mapa aún no lo usa      | Totales vigentes: `total`, `sin_agua`, `baja_presion`, `con_agua`                                                                                 |
| `GET /api/health`                         | Monitoreo                              | `{ status: 'ok' }`                                                                                                                                |

Forma de cada colonia en `/resumen`:

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [-103.35, 20.67] },
  "properties": {
    "colonia_id": 1234,
    "nombre": "Americana",
    "municipio": "Guadalajara",
    "total": 5,
    "sin_agua": 3,
    "baja_presion": 1,
    "con_agua": 1,
    "estado": "no"
  }
}
```

### Base de datos

| Tabla      | Quién la crea                                              | Columnas                                                                                                |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `reports`  | La API al arrancar (`create_all`) más una migración manual | `id` (UUID), `colonia_id` (FK a `colonias.id`), `status` (`no`/`baja`/`ok`), `created_at` (timestamptz) |
| `colonias` | `scripts/load_colonias.sh` (en `wawhere-api`)              | `id`, `geocol`, `nomcol1` (nombre), `municipio`, `cp`, `geom` (MultiPolygon, EPSG:4326, índice GIST)    |

### Tiempo real

El WebSocket solo envía mensajes; el cliente no manda nada útil. Si se cae, el frontend reconecta con backoff exponencial (de 1 s hasta 30 s) y vuelve a pedir el resumen, porque los mensajes enviados mientras estaba desconectado se pierden. Al ocultar la pestaña se cierra la conexión, y al volver se refresca. Los clientes conectados viven en la memoria del proceso de la API, así que el broadcast solo funciona con **una sola instancia** de la API.

## Estructura

```
.
├── index.html                   # Landing
├── mapa/index.html              # Página del mapa
├── public/
│   ├── favicon.svg
│   └── jalisco.geojson          # Límite estatal
├── src/
│   ├── shared/tokens.css        # Colores y variables comunes (--red, --yellow, --green…)
│   ├── landing/
│   │   ├── main.ts              # Links al mapa, FAQ, compartir
│   │   └── landing.css
│   ├── map/
│   │   ├── main.ts              # Arma el mapa, controles, flujo de reporte y carga de datos
│   │   ├── config.ts            # URLs, límites de la ZMG/Jalisco, colores y etiquetas
│   │   ├── types.ts             # Tipos espejo de los schemas de wawhere-api
│   │   ├── api.ts               # GET /resumen, POST /reports y WebSocket
│   │   ├── resumen-store.ts     # Conteos por colonia (HTTP + WebSocket)
│   │   ├── reports-layer.ts     # Círculos con conteo, colonias coloreadas y popup
│   │   ├── boundaries-layer.ts  # Colonias (vector tiles), límite de Jalisco, búsqueda de colonia
│   │   ├── layer-controls.ts    # Botones 🔢 🏘️ 📍
│   │   ├── geolocation.ts       # Ubicación del usuario y validación de la ZMG
│   │   └── map.css
│   └── vite-env.d.ts            # Tipos de las variables VITE_*
├── vite.config.ts               # Multi-page, proxy /api en dev, chunk aparte para MapLibre
├── Dockerfile                   # Build con Node 22 + nginx
└── nginx.conf
```

## Desarrollo

```bash
npm install
npm run dev       # Vite; /api se redirige a http://localhost:8000 (wawhere-api local)
npm run build     # tsc + vite build → dist/
npm run preview
```

### Variables de entorno

Todas son opcionales y se inyectan en tiempo de build (ver `.env.example`).

| Variable                   | Default              | Para qué                                             |
| -------------------------- | -------------------- | ---------------------------------------------------- |
| `VITE_MAP_URL`             | `/mapa/`             | A dónde apuntan los botones "Abrir el mapa"          |
| `VITE_API_URL`             | mismo origen         | URL de `wawhere-api`                                 |
| `VITE_MAP_STYLE_URL`       | OpenFreeMap positron | Estilo del mapa base                                 |
| `VITE_REPORT_EXPIRY_HOURS` | `24`                 | Debe coincidir con `REPORT_EXPIRY_HOURS` del backend |

## Deploy

Docker en Easypanel: el `Dockerfile` construye con Node 22 y sirve `dist/` con nginx. Las variables `VITE_*` se pasan como build args. nginx no hace proxy de `/api`; en producción la API se sirve en el mismo dominio (`wawhere.com.mx/api`) desde Easypanel.

## Atribución

- Mapa base: © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright), datos bajo ODbL. Tiles de [OpenFreeMap](https://openfreemap.org).
- Colonias: Instituto de Información Estadística y Geográfica de Jalisco (IIEG).
- Mapa: [MapLibre GL JS](https://maplibre.org) (licencia BSD-3-Clause).

---

_wawhere · proyecto comunitario · Guadalajara, Jalisco · 2026_
