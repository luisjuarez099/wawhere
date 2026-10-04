# wawhere

**¿Hay agua en tu colonia?**

Un mapa colaborativo donde los vecinos de la ZMG (Zona Metropolitana de Guadalajara) reportan si tienen agua, baja presión o servicio normal. Información en tiempo real, hecha por la comunidad, para la comunidad.

[Abrir el mapa →](/mapa/)

---

## Por qué existe esto

**Los avisos llegan tarde, o no llegan.**

Abrir la llave y que no salga agua es parte del día a día en muchas colonias del área metropolitana. Los avisos llegan tarde o no llegan, y la información se mueve por grupos de WhatsApp de forma desordenada.

wawhere junta esos reportes dispersos en un solo mapa. No es una plataforma de quejas. No tiene agenda. Es solo un termómetro del servicio que cualquiera puede consultar antes de poner la lavadora o llenar el tinaco.

---

## Cómo funciona

**Tres toques y listo.**

Abres el mapa, permites tu ubicación, y reportas el estado del agua en tu zona. Tu reporte aparece al instante para que otros vecinos lo vean. Cuando varios reportes coinciden en la misma colonia, el sistema confirma que hay un corte real.

- 🔴 **Sin agua** — las llaves salen vacías
- 🟡 **Baja presión** — sale un hilo, no es suficiente
- 🟢 **Con agua** — servicio normal

---

## Para qué te sirve

Saber si hay agua antes de necesitarla cambia cómo organizas tu día.

- Decidir si echar la carga de ropa a la lavadora
- Llenar cubetas o tinaco antes de que el corte llegue a tu zona
- Planear si cocinar en casa o comer fuera
- Programar la limpieza cuando sí hay servicio
- Avisarle a tu colonia con un solo toque

---

## Lo que somos

**Vecinos informando a vecinos.**

**Gratuito.** Hoy y siempre. Sin versión de pago. Más adelante, quien quiera podrá aportar voluntariamente al mantenimiento del proyecto.

**Privado.** No pedimos nombre, teléfono ni correo. Tu ubicación se usa solo para colocar el reporte en la zona correspondiente.

**Comunitario.** Vecinos informando a vecinos. Sin empresas detrás, sin publicidad, sin agendas.

**Informativo.** Esto no señala ni critica. Solo muestra datos para que puedas tomar mejores decisiones en tu día.

---

## Preguntas

**Lo que más nos preguntan.**

**¿Necesito crear una cuenta?**
No. Solo abre la app, permite tu ubicación y reporta.

**¿Es gratis?**
Sí. No hay planes premium ni costos ocultos.

**¿Comparten mi ubicación exacta?**
No. Se usa para ubicar el reporte en tu colonia, nada más.

**¿Cómo saben si un reporte es real?**
Cuando varios reportes coinciden en la misma zona y horario, el sistema confirma el corte. Un reporte aislado se muestra pero no se toma como confirmación.

**¿Cómo puedo ayudar?**
Usándolo y compartiéndolo. Próximamente abriremos formas de contribuir al desarrollo de la plataforma.

---

wawhere está en fase de pruebas. Mientras más personas reporten, más útil es el mapa para todos.

[Abrir el mapa](/mapa/) · **Compartir** (usa el menú nativo del teléfono o copia el enlace)

---

*wawhere · proyecto comunitario · Guadalajara, Jalisco · 2026*

---
---

# Notas técnicas

## Páginas

El sitio son dos páginas independientes construidas con Vite (multi-page). La landing no carga nada de MapLibre.

| Ruta | Archivo | Qué es |
|---|---|---|
| `/` | `index.html` → `src/landing/main.ts` | Landing con el texto de arriba, FAQ (una pregunta abierta a la vez) y botón Compartir |
| `/mapa/` | `mapa/index.html` → `src/map/main.ts` | Mapa en tiempo real y panel para reportar |

Los botones "Abrir el mapa" de la landing apuntan a `/mapa/` (o a `VITE_MAP_URL` si está definida).

## El mapa (`/mapa/`)

- **Mapa base:** MapLibre GL con el estilo *positron* de OpenFreeMap (tiles de OSM, sin API key).
- **Vista inicial:** ZMG. Se puede mover por todo Jalisco, pero solo se puede reportar dentro de la ZMG.
- **Reportar:** panel inferior con tres botones (Sin agua / Baja presión / Con agua). Pide la ubicación, la envía a la API y el reporte aparece al instante. Después de reportar hay una espera de 60 s antes de poder reportar de nuevo.
- **Capas** (controles arriba a la derecha):
  - 🔥 Zonas de calor por estado (sin agua / baja presión)
  - 🏘️ Colonias (vector tiles servidos por la API) y límite de Jalisco
  - 📌 Reportes individuales, con popup de estado, colonia y hora
  - 📍 Ir a mi ubicación
- **Datos:** se cargan por área visible (con 50 % de margen) y llegan en vivo por WebSocket, con reconexión automática. El WebSocket se cierra cuando la pestaña está oculta.
- **Vencimiento:** los reportes desaparecen después de `VITE_REPORT_EXPIRY_HOURS` (24 h por defecto).
- **Privacidad:** la API busca la colonia con la ubicación exacta, pero guarda las coordenadas redondeadas (~100 m).

## Estructura

```
.
├── index.html                 # Landing
├── mapa/index.html            # Página del mapa
├── public/
│   ├── favicon.svg
│   └── jalisco.geojson        # Límite estatal
├── src/
│   ├── shared/tokens.css      # Colores y variables comunes (--red, --yellow, --green…)
│   ├── landing/
│   │   ├── main.ts            # Links al mapa, FAQ, compartir
│   │   └── landing.css
│   ├── map/
│   │   ├── main.ts            # Arma el mapa, controles, reportar y carga de datos
│   │   ├── config.ts          # URLs, límites de la ZMG/Jalisco, colores y etiquetas
│   │   ├── types.ts           # Tipos espejo de los schemas de wawhere-api
│   │   ├── api.ts             # GET/POST /api/reports y WebSocket /api/reports/ws
│   │   ├── report-store.ts    # Reportes por id, deduplica y quita vencidos
│   │   ├── reports-layer.ts   # Heatmaps, puntos y popups
│   │   ├── boundaries-layer.ts# Colonias (vector tiles) y límite de Jalisco
│   │   ├── layer-controls.ts  # Botones 🔥 🏘️ 📌 📍
│   │   ├── geolocation.ts     # Ubicación del usuario y validación de la ZMG
│   │   └── map.css
│   └── vite-env.d.ts          # Tipos de las variables VITE_*
├── vite.config.ts             # Multi-page, proxy /api en dev, chunk aparte para MapLibre
├── Dockerfile                 # Build con Node 22 + nginx
└── nginx.conf
```

## Arquitectura

```
┌──────────────────────────┐        ┌──────────────────────────┐        ┌──────────────────────────┐
│  wawhere (este repo)     │  HTTP  │  wawhere-api (repo aparte)│  SQL   │  PostgreSQL + PostGIS    │
│  Vite + TS + MapLibre    │ ─────▶ │  FastAPI + SQLAlchemy    │ ─────▶ │                          │
│  servido por nginx       │ ◀───── │  async (asyncpg)         │ ◀───── │  tablas: reports,        │
│                          │   WS   │  + APScheduler           │        │          colonias        │
└────────────┬─────────────┘        └──────────────────────────┘        └──────────────────────────┘
             │ tiles del mapa base
             ▼
      OpenFreeMap (OSM)
```

- **Frontend:** archivos estáticos. No guarda nada en servidor; todo el estado vive en la API.
- **API:** FastAPI (Python 3.12, uvicorn, puerto 8000). Es la única que habla con la base de datos. Código en `app/routes` (endpoints), `app/services/report_service.py` (lógica y consultas), `app/models` (tablas) y `app/schemas` (validación con Pydantic).
- **Base de datos:** PostgreSQL con la extensión PostGIS (para buscar colonias y generar vector tiles).
- **Mapa base:** los tiles de calles vienen directo de OpenFreeMap; no pasan por la API.

### Comunicación frontend ↔ API

El cliente está en `src/map/api.ts` y los tipos en `src/map/types.ts` (espejo de `app/schemas/report.py`). La URL base es `VITE_API_URL`; si está vacía se usa el mismo origen.

| Endpoint | Quién lo usa | Qué hace |
|---|---|---|
| `GET /api/reports?lat_min&lat_max&lng_min&lng_max` | `fetchReports` al mover el mapa | Reportes vigentes dentro del área visible (+50 % de margen). Sin parámetros devuelve todos los vigentes |
| `POST /api/reports` | `createReport` al tocar un botón del panel | Crea el reporte. Body: `{ latitude, longitude, status: 'no' \| 'baja' \| 'ok' }`. Responde `201` con el reporte guardado, `422` si está fuera de la ZMG o `429` si se pasa del límite por IP (3/min, 20/h) |
| `WS /api/reports/ws` | `connectRealtime` | Empuja `{ type: 'new_report', report }` a todos los clientes conectados cada vez que alguien reporta |
| `GET /api/tiles/colonias/{z}/{x}/{y}.pbf` | Fuente vectorial de MapLibre (`boundaries-layer.ts`) | Polígonos de colonias en formato MVT, zoom 9–16, con `Cache-Control` de 1 día |
| `GET /api/reports/stats` | — (disponible, el mapa aún no lo usa) | Conteos vigentes: `total`, `sin_agua`, `baja_presion`, `con_agua` |
| `GET /api/health` | Monitoreo | `{ status: 'ok' }` |

Forma de un reporte (`ReportResponse`):

```json
{ "id": "uuid", "latitude": 20.672, "longitude": -103.349, "status": "no",
  "colonia": "Americana, Guadalajara", "created_at": "2026-10-02T15:04:05Z" }
```

**Tiempo real:** el WebSocket solo envía, el cliente no manda nada útil. Si se cae, el frontend reconecta con backoff exponencial (1 s → 30 s máx.) y al reconectar vuelve a pedir el área visible, porque los mensajes enviados mientras estaba desconectado se pierden. Al ocultar la pestaña se cierra la conexión y al volver se refresca. Los clientes conectados viven en memoria del proceso de la API, así que el broadcast solo funciona con **una sola instancia** de la API.

**CORS:** la API acepta los orígenes de `CORS_ORIGINS`. En desarrollo el proxy de Vite manda `/api` (incluido el WebSocket) a `http://localhost:8000`, pero la API valida el `Origin` del WebSocket, así que `http://localhost:5173` tiene que estar en `CORS_ORIGINS` de la API local.

### Flujo de un reporte

1. El usuario toca *Sin agua / Baja presión / Con agua*. El frontend obtiene la ubicación y verifica que esté dentro de la ZMG.
2. `POST /api/reports` con la ubicación exacta.
3. La API busca la colonia en PostGIS con el punto exacto: la que lo contiene o, si cae en una calle, la más cercana a menos de ~300 m.
4. Guarda el reporte con las coordenadas **redondeadas a 3 decimales (~100 m)**. La ubicación exacta no se guarda.
5. Hace broadcast por WebSocket y responde `201`. Todos los mapas abiertos (incluido el de quien reportó) agregan el punto; `report-store.ts` deduplica por `id`.

### Base de datos

| Tabla | Quién la crea | Columnas |
|---|---|---|
| `reports` | La API al arrancar (`Base.metadata.create_all`) | `id` (UUID), `latitude`, `longitude` (float, redondeadas), `status` (`no`/`baja`/`ok`), `colonia` (texto, puede ser null), `created_at` (timestamptz) |
| `colonias` | `scripts/load_colonias.sh` (en wawhere-api) | `id`, `geocol`, `nomcol1` (nombre), `municipio`, `cp`, `geom` (MultiPolygon, EPSG:4326, índice GIST) |

- **`colonias`** viene del shapefile del IIEG (marco INE 2024). El script lo descarga, lo convierte de UTM 13N a WGS84 con `ogr2ogr`, lo carga y rellena la colonia de los reportes que no la tengan. Se puede correr varias veces. Requiere `gdal-bin`, `psql`, `curl` y `unzip`.
- Si la tabla `colonias` no existe, los reportes se guardan igual, sin colonia, y la capa de colonias del mapa sale vacía.
- **Vencimiento:** solo se consultan reportes de las últimas `REPORT_EXPIRY_HOURS` (24 h). Un job de APScheduler borra los vencidos cada hora. El frontend aplica el mismo límite con `VITE_REPORT_EXPIRY_HOURS`, por eso ambos valores deben coincidir.
- **Conexión:** `DATABASE_URL` con el driver async, p. ej. `postgresql+asyncpg://usuario:pass@host:5432/wawhere`. En el `docker-compose.yml` de la API, el contenedor se conecta a un Postgres del host vía `host.docker.internal`.

### Configuración de la API

| Variable | Default | Para qué |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://wawhere:wawhere_pass@db:5432/wawhere` | Conexión a PostgreSQL/PostGIS |
| `CORS_ORIGINS` | `https://wawhere.com.mx,http://localhost:3000` | Orígenes permitidos, separados por coma |
| `REPORT_EXPIRY_HOURS` | `24` | Vigencia de un reporte |

## Variables de entorno

Todas son opcionales y se inyectan en tiempo de build (ver `.env.example`).

| Variable | Default | Para qué |
|---|---|---|
| `VITE_MAP_URL` | `/mapa/` | A dónde apuntan los botones "Abrir el mapa" |
| `VITE_API_URL` | mismo origen | URL de wawhere-api |
| `VITE_MAP_STYLE_URL` | OpenFreeMap positron | Estilo del mapa base |
| `VITE_REPORT_EXPIRY_HOURS` | `24` | Debe coincidir con `REPORT_EXPIRY_HOURS` del backend |

## Desarrollo

```bash
npm install
npm run dev       # Vite; /api se redirige a http://localhost:8000 (wawhere-api local)
npm run build     # tsc + vite build → dist/
npm run preview
```

## Deploy

Docker (Easypanel): el `Dockerfile` construye con Node 22 y sirve `dist/` con nginx. Las variables `VITE_*` se pasan como build args. nginx no hace proxy de `/api`, así que en producción hay que definir `VITE_API_URL` o servir la API en el mismo dominio por otro lado.
