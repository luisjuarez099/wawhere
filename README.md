# aguajalisco

Mapa comunitario del estado del servicio de agua en la Zona Metropolitana de Guadalajara (ZMG). Los vecinos reportan cómo está el agua en su colonia (**sin agua**, **baja presión**, **con agua** o **fuga de agua**) y, si quieren, cómo sale (turbia, con mal olor, con sedimentos u otro problema). El mapa muestra cuántos reportes hay en cada colonia en las últimas horas.

Es gratis, no pide registro y los reportes son anónimos. Está en fase de pruebas.

Sitio: [aguajalisco.org](https://wawhere.org) · Mapa: [aguajalisco.org/mapa](https://aguajalisco.org/mapa/)

---

## Finalidad

Saber rápido si el problema de agua es solo en tu casa o en toda tu colonia, y ver qué zonas de la ciudad están afectadas en este momento.

- Es **informativo y comunitario**. No tiene postura política ni busca evaluar a ninguna dependencia u organismo operador.
- No sustituye los canales oficiales para reportar fugas o fallas. Es una vista de lo que reportan los vecinos.
- Un reporte aislado se muestra, pero no confirma un corte. Mientras más vecinos de una misma colonia reporten, más confiable es la información.

## Cómo funciona

1. La persona elige su colonia, de una de dos formas:
   - **Tocando su colonia en el mapa**, sin compartir ubicación. Se abre una hoja con la información de la colonia (conteos por estado, calidad reportada y hora del último reporte) y el botón **Reportar en esta colonia**.
   - **Con el botón "Reportar aquí" (GPS):** la ubicación se usa solo dentro del navegador para encontrar la colonia en el mapa. Las coordenadas no se envían al servidor.
2. Se abre el formulario de reporte en tres pasos:
   1. **Nuevo reporte:** elige **Con agua**, **Baja presión**, **Sin agua** o **Fuga de agua** (en la calle, banqueta o red). Si eligió *Con agua* o *Baja presión*, puede marcar (opcional) cómo sale el agua: *Mal olor*, *Turbia*, *Sedimentos o color extraño* u *Otro*.
   2. **Detalles (opcional):** una descripción corta si marcó *Otro* y un comentario libre.
   3. **Confirmación:** resumen de lo enviado y la opción de avisar a los vecinos (compartir el enlace del mapa).
3. Al servidor llegan el número de colonia, el estado del agua y, si los llenó, la calidad y los textos opcionales.
4. El mapa de todas las personas conectadas se actualiza al instante con el nuevo conteo de esa colonia.
5. Los reportes vencen a las 24 horas (configurable) y se borran.

El reporte mínimo sigue siendo de dos toques: elegir el estado y **Enviar reporte**.

## Qué información obtenemos

| Se guarda                                                                 | No se guarda                      |
| ------------------------------------------------------------------------- | --------------------------------- |
| Colonia del reporte (su id en la tabla de colonias)                       | Coordenadas o ubicación exacta    |
| Estado: `no`, `baja`, `ok` o `fuga`                                       | Nombre, correo, teléfono o cuenta |
| Calidad percibida (opcional): `mal_olor`, `turbia`, `sedimentos`, `otro`  | Dirección o calle                 |
| Descripción de "Otro" (opcional, máx. 80 caracteres)                      | Fotos                             |
| Comentario (opcional, máx. 280 caracteres)                                |                                   |
| Fecha y hora del reporte                                                  |                                   |

**Qué se publica:** solo conteos por colonia. Por cada colonia con reportes vigentes, el mapa muestra el total, el desglose por estado (sin agua, baja presión, con agua, fuga), cuántas veces se reportó cada problema de calidad y la hora del reporte más reciente de la colonia. Nunca se publican reportes individuales.

**Textos libres:** la descripción de "Otro" y el comentario **son públicos**: la hoja de cada colonia muestra los 10 más recientes, con su estado y su hora, sin ningún dato de quién los escribió. Antes de devolverlos, la API oculta correos y números de teléfono (en la base queda el texto original). El formulario avisa que el texto se verá en el mapa y pide no escribir nombres, teléfonos ni direcciones. Si un comentario trae datos personales, se borra su texto de la base.

**Calidad:** es la percepción de los vecinos, no un análisis de laboratorio.

**Cuánto tiempo:** 24 horas (`REPORT_EXPIRY_HOURS`). Después, un proceso automático borra los reportes de la base de datos.

**Otros datos técnicos, para ser transparentes:**

- Como cualquier sitio web, el servidor recibe la dirección IP de quien hace una petición. La API la usa para limitar la cantidad de reportes seguidos (rate limiting) y no la guarda junto con los reportes.
- El sitio usa **Google Analytics** para medir visitas, y carga tipografías desde **Google Fonts**.

## Capas del mapa y sus fuentes

| Capa                      | Qué muestra                                                                                              | Fuente                                                                                                                                                                        | Cómo llega al mapa                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mapa base**             | Calles, nombres de lugares, relieve urbano                                                               | [OpenStreetMap](https://www.openstreetmap.org/copyright) (© colaboradores de OSM, licencia ODbL), servido por [OpenFreeMap](https://openfreemap.org) con el estilo _positron_ | Tiles vectoriales directo desde OpenFreeMap, sin pasar por la API                                                                                                                                              |
| **Colonias** 🏘️           | Polígonos y nombres de las colonias de Jalisco                                                           | Instituto de Información Estadística y Geográfica de Jalisco ([IIEG](https://iieg.gob.mx)), capa de colonias con marco INE 2024. 6,624 polígonos                              | El script `scripts/load_colonias.sh` (repo `aguajalisco-api`) descarga el shapefile, lo convierte de UTM 13N a WGS84 con `ogr2ogr` y lo carga en PostGIS. La API lo sirve como vector tiles (MVT) en zoom 9–16 |
| **Límite de Jalisco**     | Contorno punteado del estado                                                                             | _Fuente por confirmar_                                                                                                                                                        | Archivo estático `public/jalisco.geojson`                                                                                                                                                                      |
| **Municipios**            | Límites y nombres de los 125 municipios de Jalisco                                                       | [INEGI](https://www.inegi.org.mx/temas/mg/), Marco Geoestadístico 2023 (vía [mexico-geojson](https://github.com/PhantomInsights/mexico-geojson))                              | Archivo estático `public/municipios.geojson` (~700 KB, ~210 KB con gzip). Polígonos simplificados (~30 m en la ZMG, ~100 m en el resto) y un punto interior por municipio para su nombre                       |
| **Mapas base opcionales** | OpenStreetMap estándar e imágenes satelitales                                                            | [OpenStreetMap](https://www.openstreetmap.org/copyright) y [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)                    | Tiles raster que se eligen en el botón de capas; solo se descargan cuando están activos                                                                                                                        |
| **Conteo por colonia** 🔢 | Círculo con el número de reportes vigentes, del color del estado más reportado (en empate, el más grave) | Reportes de los vecinos                                                                                                                                                       | `GET /api/reports/resumen` y actualizaciones por WebSocket                                                                                                                                                     |
| **Colonias coloreadas**   | La colonia completa se pinta del color de su estado                                                      | Reportes de los vecinos, sobre la capa de colonias                                                                                                                            | `feature-state` de MapLibre sobre los tiles de colonias                                                                                                                                                        |

El círculo de cada colonia se dibuja en un punto interior de su polígono (`ST_PointOnSurface`). Es un punto fijo de la colonia, no la ubicación de quien reportó.

**Zona de reportes:** se acepta cualquier colonia de los municipios de la ZMG. La lista está en `ZMG_MUNICIPIOS`, en `aguajalisco-api/app/services/report_service.py`. El mapa se puede recorrer por todo Jalisco, pero solo se puede reportar dentro de la ZMG.

## Cómo está construido

```
┌──────────────────────────┐        ┌───────────────────────────┐        ┌──────────────────────────┐
│  aguajalisco (este repo)     │  HTTP  │  aguajalisco-api (repo aparte)│  SQL   │  PostgreSQL + PostGIS    │
│  Vite + TS + MapLibre    │ ─────▶ │  FastAPI + SQLAlchemy     │ ─────▶ │                          │
│  servido por nginx       │ ◀───── │  async (asyncpg)          │ ◀───── │  tablas: reports,        │
│                          │   WS   │  + APScheduler            │        │          colonias        │
└────────────┬─────────────┘        └───────────────────────────┘        └──────────────────────────┘
             │ tiles del mapa base
             ▼
      OpenFreeMap (OSM)
```

- **Frontend (este repo):** sitio estático con Vite, TypeScript y MapLibre GL JS. No guarda nada en servidor. Ubica la colonia del usuario consultando los tiles de colonias que ya tiene en pantalla.
- **API (`aguajalisco-api`):** FastAPI con Python 3.12. Es la única que habla con la base de datos. Valida la colonia, guarda el reporte, calcula los conteos y avisa por WebSocket.
- **Base de datos:** PostgreSQL con PostGIS (imagen `postgis/postgis:17-3.5`). PostGIS genera los vector tiles de colonias y el punto interior de cada colonia.
- **Infraestructura:** VPS propio con Easypanel. Frontend y API corren en contenedores Docker separados.

### Endpoints

| Endpoint                                  | Quién lo usa                           | Qué hace                                                                                                                                          |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/reports/resumen`                | `fetchResumen`, al cargar y cada 2 min | GeoJSON con un punto por colonia y sus conteos vigentes                                                                                           |
| `POST /api/reports`                       | `createReport`, al enviar el reporte   | Body: `{ colonia_id, status, quality?, quality_other?, comment? }`. Responde `201` (con `quality`, sin los textos libres), `422` y `429` (ver abajo) |
| `GET /api/colonias/{id}`                  | Hoja de colonia (`getColoniaDetalle`)  | Conteos de los reportes activos de una colonia (por estado, por calidad, fecha del último reporte) y sus últimos 10 comentarios. Si falla, la hoja usa los conteos de `/resumen` |
| `GET /api/colonias?q=`                    | Buscador (`searchColonias`)            | Hasta 8 colonias cuyo nombre contiene `q` (sin importar acentos), con su `bbox`. `lng`/`lat` es el centro del mapa visible, para ordenar las homónimas por cercanía |
| `WS /api/reports/ws`                      | `connectRealtime`                      | Envía `{ type: 'colonia_update', feature }` con el conteo nuevo de una colonia cada vez que alguien reporta                                       |
| `GET /api/tiles/colonias/{z}/{x}/{y}.pbf` | Fuente vectorial de MapLibre           | Polígonos de colonias en MVT, zoom 9–16, con caché de 1 día                                                                                       |
| `GET /api/reports/stats`                  | Resumen de reportes (`fetchStats`)     | Totales vigentes: `total`, `sin_agua`, `baja_presion`, `con_agua`, `fugas`, y `historico` (reportes de suministro desde el inicio). El mapa solo usa `historico` |
| `GET /api/health`                         | Monitoreo                              | `{ status: 'ok' }`                                                                                                                                |

Reglas de `POST /api/reports`:

| Campo           | Reglas                                                                               |
| --------------- | ------------------------------------------------------------------------------------ |
| `quality`       | Máximo 4 valores sin repetir. Debe ir vacío si `status` es `no`                       |
| `quality_other` | Máximo 80 caracteres. Solo se acepta si `quality` incluye `otro`, y en ese caso es obligatorio |
| `comment`       | Máximo 280 caracteres                                                                 |

El `422` trae `detail` como **texto** cuando la colonia no es válida o está fuera de la ZMG, y como **arreglo** (errores de validación) cuando falla alguno de los campos anteriores. El frontend muestra un mensaje distinto para cada caso.

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
    "fugas": 0,
    "estado": "no"
  }
}
```

### Base de datos

| Tabla      | Quién la crea                                              | Columnas                                                                                                |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `reports`  | La API al arrancar (`create_all`) más migraciones manuales | `id` (UUID), `colonia_id` (FK a `colonias.id`), `status` (`no`/`baja`/`ok`/`fuga`), `quality` (arreglo de texto), `quality_other` (≤ 80), `comment` (≤ 280), `created_at` (timestamptz) |
| `colonias` | `scripts/load_colonias.sh` (en `aguajalisco-api`)          | `id`, `geocol`, `nomcol1` (nombre), `municipio`, `cp`, `geom` (MultiPolygon, EPSG:4326, índice GIST)    |

### Tiempo real

El WebSocket solo envía mensajes; el cliente no manda nada útil. Si se cae, el frontend reconecta con backoff exponencial (de 1 s hasta 30 s) y vuelve a pedir el resumen, porque los mensajes enviados mientras estaba desconectado se pierden. Al ocultar la pestaña se cierra la conexión, y al volver se refresca. Los clientes conectados viven en la memoria del proceso de la API, así que el broadcast solo funciona con **una sola instancia** de la API.

## Estructura

```
.
├── index.html                   # Landing
├── mapa/index.html              # Página del mapa
├── public/
│   ├── favicon.svg
│   ├── jalisco.geojson          # Límite estatal
│   └── municipios.geojson       # Límites y nombres de los 125 municipios (INEGI)
├── src/
│   ├── shared/tokens.css        # Colores y variables comunes (--red, --yellow, --green…)
│   ├── landing/
│   │   ├── main.ts              # Links al mapa, FAQ, compartir
│   │   └── landing.css
│   ├── map/
│   │   ├── main.ts              # Arma el mapa, controles, selección de colonia, GPS y carga de datos
│   │   ├── report-sheet.ts      # Formulario de reporte en 3 pasos (estado, calidad, detalles, confirmación)
│   │   ├── colonia-sheet.ts     # Hoja informativa al tocar una colonia (conteos y comentarios)
│   │   ├── colonia-search.ts    # Buscador de colonias (lupa que despliega la barra)
│   │   ├── stats-panel.ts       # Resumen de reportes para el ciudadano (24 h e histórico)
│   │   ├── config.ts            # URLs, límites de la ZMG/Jalisco, colores, etiquetas de estado y calidad
│   │   ├── types.ts             # Tipos espejo de los schemas de aguajalisco-api
│   │   ├── api.ts               # GET /resumen, GET /colonias (búsqueda y detalle), POST /reports y WebSocket
│   │   ├── resumen-store.ts     # Conteos por colonia (HTTP + WebSocket)
│   │   ├── reports-layer.ts     # Clusters con conteo, mapa de calor y colonias coloreadas
│   │   ├── boundaries-layer.ts  # Colonias (vector tiles), límites de Jalisco y municipios, búsqueda de colonia
│   │   ├── basemaps.ts          # Mapas base: Claro, OpenStreetMap, Satélite
│   │   ├── layer-controls.ts    # Botón de capas: mapa base y capas visibles
│   │   ├── geolocation.ts       # Ubicación del usuario y validación de la ZMG
│   │   └── map.css
│   └── vite-env.d.ts            # Tipos de las variables VITE_*
├── vite.config.ts               # Multi-page, proxy /api en dev, chunk aparte para MapLibre
├── Dockerfile                   # Build con Node 22 + nginx
└── nginx.conf
```

## Interfaz del mapa

- **Hoja de colonia:** al tocar una colonia. Muestra nombre, municipio y CP, el estado dominante ("Mayoría sin agua"), la fecha del último reporte en hora de Guadalajara ("Hoy a las 11:16 a.m."), una barra con los conteos por estado y los problemas de calidad reportados. En el teléfono es una hoja inferior; en tablet y escritorio, un panel a la izquierda.
- **Resumen de reportes:** arriba del panel de abajo, una línea con un punto "en vivo": "8 reportes en las últimas 24 h · 4 colonias". *Resumen* despliega la barra y los conteos por estado con porcentaje, colonias con reportes, colonias mayormente sin agua, reportes desde el inicio y la hora de la última actualización. Las cifras de 24 h se calculan con el mismo resumen del mapa, así que cambian con cada reporte en vivo. Por ahora no cuenta las fugas.
- **Buscador de colonias:** la lupa junto al logo despliega una barra de búsqueda; se cierra con la misma lupa, con ✕, con `Esc` o tocando el mapa. Se navega con flechas y Enter. Al elegir una colonia se abre su hoja y el mapa la acerca sin que la tape la hoja. En el teléfono el logo se oculta mientras la barra está abierta.
- **Fugas de agua:** cuarto estado del reporte, en cian. Cada fuga cuenta como un reporte más de la colonia: suma en su círculo y en los grupos, y si es el estado más reportado, el círculo y la colonia se pintan de cian. En empate entre estados gana el más grave: sin agua, fuga, baja presión, con agua.
- **Clusters y mapa de calor:** los puntos de colonias cercanas se agrupan hasta zoom 13 en un círculo con la suma de reportes, del color del estado más frecuente; tocarlo acerca el mapa. El mapa de calor (morado, para no confundirse con los colores de suministro) pesa los problemas: *sin agua* cuenta 1, *baja presión* y *fuga* 0.5; se desvanece de cerca, donde ya se ven las colonias coloreadas. Ambos se calculan con un punto interior de cada colonia, nunca con la ubicación de quien reportó, y se pueden apagar en el botón de capas.
- **Formulario de reporte:** hoja de pantalla completa en el teléfono y panel lateral de 400 px en pantallas de 768 px o más, para que el mapa siga visible.
- **Colores:** los de estado (verde, amarillo, rojo y cian para fugas) solo significan estado; la calidad usa siempre una familia naranja para no confundir "turbia" con "baja presión". El color nunca es la única señal: cada estado lleva su texto y los problemas marcados llevan "✓".
- **Accesibilidad:** estados y problemas son inputs nativos (radio y checkbox), se puede usar todo con teclado, `Esc` cierra la hoja de arriba y el foco vuelve al botón que la abrió. Objetivos táctiles de 44 px como mínimo y campos de texto de 16 px para que iOS no haga zoom.
- **Tipografía:** Bricolage Grotesque (títulos) y Public Sans (formularios), desde Google Fonts.

## Desarrollo

```bash
npm install
npm run dev       # Vite; /api se redirige a http://localhost:8000 (aguajalisco-api local)
npm run build     # tsc + vite build → dist/
npm run preview
```

### Variables de entorno

Todas son opcionales y se inyectan en tiempo de build (ver `.env.example`).

| Variable                   | Default              | Para qué                                             |
| -------------------------- | -------------------- | ---------------------------------------------------- |
| `VITE_MAP_URL`             | `/mapa/`             | A dónde apuntan los botones "Abrir el mapa"          |
| `VITE_API_URL`             | mismo origen         | URL de `aguajalisco-api`                             |
| `VITE_MAP_STYLE_URL`       | OpenFreeMap positron | Estilo del mapa base                                 |
| `VITE_REPORT_EXPIRY_HOURS` | `24`                 | Debe coincidir con `REPORT_EXPIRY_HOURS` del backend |

## Cambios recientes

### Calidad del agua y hoja de colonia

- **Reporte en 3 pasos:** tocar un estado ya no envía el reporte al instante; lo selecciona, y se envía con **Enviar reporte**. Se agregaron la calidad percibida (opcional), la descripción de "Otro" y un comentario.
- **Validación en el navegador:** *Sin agua* oculta y deshabilita las opciones de calidad; la descripción de "Otro" solo se envía con *Otro* marcado y es obligatoria en ese caso; los textos tienen límite de caracteres. Así se evitan los `422` de validación.
- **Mensajes de error:** se distinguen los dos tipos de `422` (colonia inválida o fuera de la ZMG vs. datos del formulario) y el `429`. La selección del usuario se conserva al fallar.
- **Confirmación:** el resumen se arma con lo que devolvió la API. Incluye "Avisar a mis vecinos" (menú de compartir del teléfono o copiar enlace). El enlace compartido es el del mapa, sin datos del reporte.
- **Hoja de colonia:** reemplaza el popup que aparecía al tocar una colonia. Usa `GET /api/colonias/{id}` y, si no responde, muestra los conteos de `/resumen`.
- **Panel inferior:** ahora es un solo botón, "Reportar aquí" (GPS) o "Reportar en {colonia}" si hay una colonia elegida. Se oculta mientras la hoja de colonia está abierta.
- **Pendiente (requiere backend):** selector Suministro/Calidad sobre el mapa, conteo de calidad en la confirmación con umbral mínimo de reportes, y fotos.

### Buscador, clusters, mapa de calor y comentarios

- **Buscador de colonias** con el endpoint nuevo `GET /api/colonias?q=`.
- **Clusters y mapa de calor** de los reportes; las colonias siguen coloreadas por estado.
- **Comentarios públicos:** la hoja de colonia muestra los últimos 10 comentarios y textos de "Otro", con correos y teléfonos ocultos. El paso *Detalles* del formulario ahora avisa que el texto será público.

### Fugas de agua

- **Nuevo estado `fuga`** en el formulario (las cuatro opciones en cuadrícula de 2 × 2), en la hoja de colonia, en los círculos y clusters de cada colonia y en el mapa de calor.
- **Resumen de reportes** en el panel de abajo (24 h, desglose, colonias e histórico), sin contar fugas por ahora.
- **Requiere** correr en la base `scripts/migrations/2026-10-12-status-fuga.sql` de `wawhere-api` antes de desplegar; sin eso la API responde `500` al guardar una fuga.

## Deploy

Docker en Easypanel: el `Dockerfile` construye con Node 22 y sirve `dist/` con nginx. Las variables `VITE_*` se pasan como build args. nginx no hace proxy de `/api`; en producción la API se sirve en el mismo dominio (`aguajalisco.com.mx/api`) desde Easypanel.

## Atribución

- Mapa base: © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright), datos bajo ODbL. Tiles de [OpenFreeMap](https://openfreemap.org).
- Colonias: Instituto de Información Estadística y Geográfica de Jalisco (IIEG).
- Municipios: Instituto Nacional de Estadística y Geografía ([INEGI](https://www.inegi.org.mx/temas/mg/)), Marco Geoestadístico 2023.
- Mapa satelital: imágenes © Esri, Maxar, Earthstar Geographics.
- Mapa: [MapLibre GL JS](https://maplibre.org) (licencia BSD-3-Clause).

---

_aguajalisco · proyecto comunitario · Guadalajara, Jalisco · 2026_
