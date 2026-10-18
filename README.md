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
   1. **Nuevo reporte:** elige **Con agua**, **Baja presión** o **Sin agua**. La opción **Fuga de agua** (en la calle, banqueta o red) está oculta por ahora. Si eligió *Con agua* o *Baja presión*, puede marcar (opcional) cómo sale el agua: *Mal olor*, *Turbia*, *Sedimentos o color extraño* u *Otro*. Con **Con agua** o **Baja presión** también puede marcar que el agua está en buenas condiciones: *Limpia*, *Cristalina* o *Sin olor* (una colonia puede tener baja presión y agua limpia). Esas opciones no van junto con los problemas: marcar una desmarca las de la otra.
   2. **Detalles (opcional):** una descripción corta si marcó *Otro* y un comentario libre.
   3. **Confirmación:** resumen de lo enviado y la opción de avisar a los vecinos (compartir el enlace del mapa).
3. Al servidor llegan el número de colonia, el estado del agua y, si los llenó, la calidad y los textos opcionales.
4. El mapa de todas las personas conectadas se actualiza al instante con el nuevo conteo de esa colonia.
5. Los reportes dejan de contar en el mapa a las 24 horas (configurable). No se borran: el histórico los conserva.

El reporte mínimo sigue siendo de dos toques: elegir el estado y **Enviar reporte**.

## Qué información obtenemos

| Se guarda                                                                 | No se guarda                      |
| ------------------------------------------------------------------------- | --------------------------------- |
| Colonia del reporte (su id en la tabla de colonias)                       | Coordenadas o ubicación exacta    |
| Estado: `no`, `baja`, `ok` o `fuga`                                       | Nombre, correo, teléfono o cuenta |
| Calidad percibida (opcional): `mal_olor`, `turbia`, `sedimentos`, `otro`, o `limpia`, `cristalina`, `sin_olor` (con `ok` o `baja`) | Dirección o calle                 |
| Descripción de "Otro" (opcional, máx. 80 caracteres)                      | Fotos                             |
| Comentario (opcional, máx. 280 caracteres)                                |                                   |
| Fecha y hora del reporte                                                  |                                   |

**Qué se publica:** solo conteos por colonia. Por cada colonia con reportes vigentes, el mapa muestra el total, el desglose por estado (sin agua, baja presión, con agua, fuga), cuántas veces se reportó cada problema de calidad y la hora del reporte más reciente de la colonia. Nunca se publican reportes individuales.

**Textos libres:** la descripción de "Otro" y el comentario **son públicos**: la hoja de cada colonia los muestra todos, del más reciente al más viejo (10 al abrirla y el resto con *Ver más comentarios*), con su estado y su hora, sin ningún dato de quién los escribió. Antes de devolverlos, la API oculta correos y números de teléfono (en la base queda el texto original). El formulario avisa que el texto se verá en el mapa y pide no escribir nombres, teléfonos ni direcciones. Si un comentario trae datos personales, se borra su texto de la base.

**Calidad:** es la percepción de los vecinos, no un análisis de laboratorio.

**Cuánto tiempo:** los reportes se muestran durante 24 horas (`REPORT_EXPIRY_HOURS`). Después dejan de contar en el mapa, pero **no se borran**: el histórico de reportes de agua depende de conservarlos. Hoy no existe ningún proceso que los elimine.

**Otros datos técnicos, para ser transparentes:**

- Como cualquier sitio web, el servidor recibe la dirección IP de quien hace una petición. La API la usa para limitar la cantidad de reportes seguidos (rate limiting) y no la guarda junto con los reportes.
- El sitio usa **Google Analytics** para medir visitas, y carga tipografías desde **Google Fonts**.

## Capas del mapa y sus fuentes

| Capa                      | Qué muestra                                                                                              | Fuente                                                                                                                                                                        | Cómo llega al mapa                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mapa base**             | Calles, nombres de lugares, relieve urbano                                                               | [OpenStreetMap](https://www.openstreetmap.org/copyright) (© colaboradores de OSM, licencia ODbL), servido por [OpenFreeMap](https://openfreemap.org) con el estilo _positron_ | Tiles vectoriales directo desde OpenFreeMap, sin pasar por la API                                                                                                                                              |
| **Colonias** 🏘️           | Polígonos y nombres de las colonias de Jalisco                                                           | Instituto de Información Estadística y Geográfica de Jalisco ([IIEG](https://iieg.gob.mx)), capa de colonias con marco INE 2024. 6,624 polígonos                              | El script `scripts/load_colonias.sh` (repo `wawhere-api`) descarga el shapefile, lo convierte de UTM 13N a WGS84 con `ogr2ogr` y lo carga en PostGIS. La API lo sirve como vector tiles (MVT) en zoom 9–16 |
| **Límite de Jalisco**     | Contorno punteado del estado                                                                             | _Fuente por confirmar_                                                                                                                                                        | Archivo estático `public/jalisco.geojson`                                                                                                                                                                      |
| **Municipios**            | Límites y nombres de los 125 municipios de Jalisco                                                       | [INEGI](https://www.inegi.org.mx/temas/mg/), Marco Geoestadístico 2023 (vía [mexico-geojson](https://github.com/PhantomInsights/mexico-geojson))                              | Archivo estático `public/municipios.geojson` (~700 KB, ~210 KB con gzip). Polígonos simplificados (~30 m en la ZMG, ~100 m en el resto) y un punto interior por municipio para su nombre                       |
| **Mapas base opcionales** | OpenStreetMap estándar e imágenes satelitales                                                            | [OpenStreetMap](https://www.openstreetmap.org/copyright) y [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)                    | Tiles raster que se eligen en el botón de capas; solo se descargan cuando están activos                                                                                                                        |
| **Conteo por colonia** 🔢 | Dona con el número de reportes vigentes al centro y un anillo dividido por estado (sin agua, fuga, baja presión, con agua), en grupos y en colonias | Reportes de los vecinos                                                                                                                                                       | `GET /api/reports/resumen` y actualizaciones por WebSocket                                                                                                                                                     |
| **Zonas de racionamiento** 📅 | Las 7 zonas del esquema rotatorio del SIAPA; las que tienen racionamiento hoy se ven más marcadas. Visible al inicio (`ZONAS_AL_INICIO` en `main.ts`); se apaga desde el panel o el botón de capas | [SIAPA](https://rotaciondeserviciosiapa.jalisco.gob.mx/): mapa de zonas (Google My Maps, KML), colonias por zona (`rotacion-siapa.topo.json`) y calendario (`ajustes.php`) | `scripts/load_rotacion.py` (repo `wawhere-api`) carga el KML y el TopoJSON en PostGIS; la API sirve las zonas en `GET /api/rotacion/zonas.geojson` y lee el calendario del SIAPA cada hora (respaldo en `app/data/rotacion.json`) |
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
| `GET /api/colonias/{id}`                  | Hoja de colonia (`getColoniaDetalle`)  | Conteos de los reportes activos de una colonia (por estado, por calidad, fecha del último reporte) y la primera página de comentarios (10, con `comentarios_total` y `comentarios_hay_mas`). Si falla, la hoja usa los conteos de `/resumen` |
| `GET /api/colonias/{id}/comentarios`      | "Ver más comentarios" (`getColoniaComentarios`) | Siguiente página (20) de comentarios más viejos que `antes` (el `created_at` del último mostrado). Responde `{ comentarios, hay_mas }` |
| `GET /api/colonias?q=`                    | Buscador (`searchColonias`)            | Hasta 8 colonias cuyo nombre contiene `q` (sin importar acentos), con su `bbox`. `lng`/`lat` es el centro del mapa visible, para ordenar las homónimas por cercanía |
| `GET /api/rotacion`                       | Panel de racionamiento (`fetchRotacion`) | Calendario del esquema rotatorio del SIAPA: días por zona, si hoy le toca, fuente, fecha y contacto |
| `GET /api/rotacion/zonas.geojson`         | Capa *Zonas de racionamiento*          | Polígonos de las 7 zonas                                                                                                                          |
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
| `colonias` | `scripts/load_colonias.sh` (en `wawhere-api`)          | `id`, `geocol`, `nomcol1` (nombre), `municipio`, `cp`, `geom` (MultiPolygon, EPSG:4326, índice GIST)    |
| `zonas_rotacion` | `scripts/load_rotacion.py` (en `wawhere-api`) | `zona`, `nombre`, `sector`, `geom` (polígonos de las 7 zonas del SIAPA, índice GIST) |
| `colonias_siapa` | `scripts/load_rotacion.py` (en `wawhere-api`) | `colonia_id`, `clave`, `zonas` (la colonia del SIAPA que le corresponde a cada colonia, unida por geometría) |
| `colonias_rotacion` | `scripts/load_rotacion.py` (en `wawhere-api`) | `colonia_id`, `zona`, `porcentaje` (zonas que el SIAPA asigna a cada colonia; el porcentaje de área es informativo y puede ser 0) |

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
│   │   ├── rotacion-panel.ts    # Botón de calendario: racionamiento programado del SIAPA
│   │   ├── rotacion-layer.ts    # Zonas del esquema rotatorio en el mapa
│   │   ├── config.ts            # URLs, límites de la ZMG/Jalisco, colores, etiquetas de estado y calidad
│   │   ├── types.ts             # Tipos espejo de los schemas de aguajalisco-api
│   │   ├── api.ts               # GET /resumen, GET /colonias (búsqueda y detalle), POST /reports y WebSocket
│   │   ├── resumen-store.ts     # Conteos por colonia (HTTP + WebSocket)
│   │   ├── reports-layer.ts     # Fuente agrupada de conteos, mapa de calor y colonias coloreadas
│   │   ├── donut.ts             # Dona SVG: segmentos por estado (función pura) y dibujo
│   │   ├── donut-markers.ts     # Donas como marcadores HTML sobre grupos y colonias
│   │   ├── boundaries-layer.ts  # Colonias (vector tiles), límites de Jalisco y municipios, búsqueda de colonia
│   │   ├── basemaps.ts          # Mapas base: Claro, OpenStreetMap, Satélite
│   │   ├── layer-controls.ts    # Botón de capas: mapa base y capas visibles
│   │   ├── legend-control.ts    # Botón de leyenda (debajo de ubicación) con panel de colores y dona de ejemplo
│   │   ├── geolocation.ts       # Ubicación del usuario y validación de la ZMG
│   │   └── map.css
│   └── vite-env.d.ts            # Tipos de las variables VITE_*
├── vite.config.ts               # Multi-page, proxy /api en dev, chunk aparte para MapLibre
├── Dockerfile                   # Build con Node 22 + nginx
└── nginx.conf
```

## Interfaz del mapa

- **Hoja de colonia:** al tocar una colonia. Muestra nombre, municipio y CP, el estado dominante ("Mayoría sin agua"), la fecha del último reporte en hora de Guadalajara ("Hoy a las 11:16 a.m."), una barra con los conteos por estado y los problemas de calidad reportados. En el teléfono es una hoja inferior; en tablet y escritorio, un panel a la izquierda.
- **Racionamiento programado (SIAPA):** el botón de calendario junto a la lupa abre un panel con las zonas que tienen racionamiento hoy ("Hoy martes: baja presión en Zona 2 y Zona 5"), el calendario semanal con el día de hoy resaltado, un interruptor para ver las zonas en el mapa, los contactos del SIAPA (WhatsApp y 073) y la fuente con su fecha. La hoja de cada colonia muestra su zona (o zonas, igual que la página del SIAPA), los días y "Hoy le toca" o "Próximo: el viernes". Se aclara que no son cortes totales y, si la colonia está en varias zonas, que hay que revisarlas todas. Detalles: `wawhere-api/docs/rotacion-siapa.md`.
- **Resumen de reportes:** arriba del panel de abajo, siempre visible: el conteo "4 reportes de agua en las últimas 24 h" (y la fuga aparte, si hay), la barra y los conteos por estado con porcentaje, colonias con reportes, colonias mayormente sin agua, reportes desde el inicio y la hora de la última actualización. Sin reportes dice "Sin reportes en las últimas 24 h. ¡Sé el primero!", y mientras carga, "Cargando reportes…". La fila con el titular ("N colonias reportan sin agua") y el botón *Resumen* sigue en el HTML pero oculta (`hidden` en `#stats-toggle`). Las cifras de 24 h se calculan con el mismo resumen del mapa, así que cambian con cada reporte en vivo. Los reportes de agua suman en "N reportes de agua en las últimas 24 h"; las fugas van en una línea aparte ("N reportes de fuga"). El histórico ("Reportes de agua desde el inicio") cuenta solo reportes de agua.
- **Buscador de colonias:** la lupa junto al logo despliega una barra de búsqueda; se cierra con la misma lupa, con ✕, con `Esc` o tocando el mapa. Se navega con flechas y Enter. Al elegir una colonia se abre su hoja y el mapa la acerca sin que la tape la hoja. En el teléfono el logo se oculta mientras la barra está abierta.
- **Fugas de agua (oculto por ahora):** el backend sigue aceptando el estado `fuga`, pero el formulario no lo ofrece (la opción tiene `hidden`) y el mapa no lo dibuja: no hay segmento en las donas, no tiñe colonias, no suma al calor, no está en la leyenda ni en la hoja de colonia. Sí se cuenta aparte en el panel de resumen. Para volver a mostrarla, quitar `hidden` de su opción en `mapa/index.html` y restaurar los segmentos en `config.ts` (`DONUT_ORDER`), la leyenda y el tinte.
- **Donas, clusters y mapa de calor:** cada colonia con reportes se dibuja como una dona: centro blanco con el total y un anillo con la parte de cada estado, de más grave a menos grave en sentido horario desde las 12 (sin agua, baja presión, con agua; las fugas, por ahora, no se dibujan). Así se distingue un problema generalizado de una zona dividida. Cada estado presente ocupa al menos 6° del anillo para que no desaparezca, así que la proporción es aproximada; el número exacto está en la hoja de colonia. Hasta zoom 13 las colonias cercanas se agrupan en una dona con la suma de sus conteos; tocarla acerca el mapa, y tocar la dona de una colonia abre su hoja. Las donas son botones con el desglose en texto (`aria-label` y `title`), y se apagan con *Número de reportes* en el botón de capas. Son marcadores HTML con SVG (`donut-markers.ts`); si algún día hay más de ~300 visibles a la vez, conviene pasarlas a imágenes en una capa `symbol`. El mapa de calor (morado, para no confundirse con los colores de suministro) pesa los problemas: *sin agua* cuenta 1 y *baja presión* 0.5 (las fugas, por ahora, no); se desvanece de cerca, donde ya se ven las colonias coloreadas. Ambos se calculan con un punto interior de cada colonia, nunca con la ubicación de quien reportó. Al entrar, el mapa de calor está prendido; se apaga en el botón de capas.
- **Formulario de reporte:** hoja de pantalla completa en el teléfono y panel lateral de 400 px en pantallas de 768 px o más, para que el mapa siga visible.
- **Colores:** los de estado (verde, amarillo y rojo; el cian de fugas está oculto por ahora) solo significan estado; la calidad usa siempre una familia naranja para no confundir "turbia" con "baja presión". El color nunca es la única señal: cada estado lleva su texto y los problemas marcados llevan "✓".
- **Accesibilidad:** estados y problemas son inputs nativos (radio y checkbox), se puede usar todo con teclado, `Esc` cierra la hoja de arriba y el foco vuelve al botón que la abrió. Objetivos táctiles de 44 px como mínimo y campos de texto de 16 px para que iOS no haga zoom.
- **Leyenda:** botón con ícono de lista debajo del de ubicación, con el estilo de los controles de MapLibre. Abre un panel a la izquierda, como el de capas, con los tres estados de agua y una dona de ejemplo que explica el número y el anillo. Se cierra con el mismo botón, con `Esc` o tocando fuera.
- **Atribución:** queda cerrada al cargar (solo la "i"); MapLibre la abre sola con `compact: true`, así que `main.ts` la cierra en el `load`.
- **Panel de reporte plegable:** el botón "Ocultar", arriba del panel, lo deja en una barra "Reportar" para ver más mapa. Los controles de abajo bajan con él. Empieza abierto.
- **Capas al entrar:** colonias, donas con número, zonas de racionamiento, colonias coloreadas, mapa de calor y municipios. Se apagan desde el botón de capas; el estado inicial está en `CALOR_AL_INICIO`, `MUNICIPIOS_AL_INICIO` y `ZONAS_AL_INICIO` en `main.ts`.
- **Clima oculto:** el control de clima no se muestra mientras `CLIMA_VISIBLE` sea `false` en `main.ts`.
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

### Donas para reportes mixtos

- **Grupos y colonias como donas:** el círculo de un solo color se reemplazó por un anillo dividido por estado, con el total al centro. No cambia la API: los conteos ya venían en `/resumen`.
- **Tocar:** la dona de un grupo acerca el mapa; la de una colonia abre su hoja (el CP se toma del polígono, porque `/resumen` no lo trae).
- **Sin cambios** en el mapa de calor, las colonias coloreadas ni la capa del SIAPA.
- **Pendiente:** revisar en teléfono (iPhone y Android), en el mapa satelital y el rendimiento con muchas donas.

### Presentación del mapa

- **Resumen siempre visible:** se ocultó la fila del titular y el botón *Resumen*; las estadísticas se ven sin desplegar nada. El subtítulo del panel aclara que son reportes de vecinos, no datos oficiales, y el plazo sale de `VITE_REPORT_EXPIRY_HOURS`.
- **Leyenda de colores:** botón debajo del de ubicación que abre un panel. La atribución ya no se abre sola.
- **Panel de reporte plegable:** "Ocultar" deja solo la barra "Reportar" para ver más mapa.
- **Capas al entrar:** mapa de calor y municipios prendidos por defecto (se apagaron un tiempo y se volvieron a activar).
- **Clima oculto** por ahora (`CLIMA_VISIBLE = false` en `main.ts`).
- **Estados de carga y error** en el resumen, en vez de quedarse en blanco.
- **Pendiente:** revisar el diseño en teléfono (390 px) y decidir cómo cuentan las fugas en el titular y la barra.

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
- **Comentarios públicos:** la hoja de colonia muestra todos los comentarios y textos de "Otro" (de 10 en 10 al principio y luego de 20 en 20 con *Ver más comentarios*), con correos y teléfonos ocultos. El paso *Detalles* del formulario ahora avisa que el texto será público.

### Fugas de agua

- **Nuevo estado `fuga`** en el formulario (las cuatro opciones en cuadrícula de 2 × 2), en la hoja de colonia, en los círculos y clusters de cada colonia y en el mapa de calor.
- **Resumen de reportes** en el panel de abajo (24 h, desglose, colonias e histórico), sin contar fugas por ahora.
- **Requiere** correr en la base `scripts/migrations/2026-10-12-status-fuga.sql` de `wawhere-api` antes de desplegar; sin eso la API responde `500` al guardar una fuga.

### Racionamiento programado del SIAPA

- **Datos:** zonas del mapa oficial del SIAPA (KML), colonias por zona tal como las asigna el SIAPA (su TopoJSON) y calendario leído cada hora de su página. Proceso, verificación y cómo actualizar en `wawhere-api/docs/rotacion-siapa.md`.
- **Hoja de colonia:** bloque "Racionamiento programado · SIAPA".
- **Botón de calendario** con el panel semanal y la capa *Zonas de racionamiento* (también en el botón de capas).
- **Requiere** correr `scripts/load_rotacion.py` en la base de producción; sin eso, el calendario se ve pero las colonias no muestran zona y la capa sale vacía.

## Deploy

Docker en Easypanel: el `Dockerfile` construye con Node 22 y sirve `dist/` con nginx. Las variables `VITE_*` se pasan como build args. nginx no hace proxy de `/api`; en producción la API se sirve en el mismo dominio (`aguajalisco.com.mx/api`) desde Easypanel.

## Atribución

- Mapa base: © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright), datos bajo ODbL. Tiles de [OpenFreeMap](https://openfreemap.org).
- Colonias: Instituto de Información Estadística y Geográfica de Jalisco (IIEG).
- Municipios: Instituto Nacional de Estadística y Geografía ([INEGI](https://www.inegi.org.mx/temas/mg/)), Marco Geoestadístico 2023.
- Mapa satelital: imágenes © Esri, Maxar, Earthstar Geographics.
- Racionamiento programado: SIAPA y Gobierno de Jalisco, [esquema rotatorio de Agua Limpia para Jalisco](https://rotaciondeserviciosiapa.jalisco.gob.mx/). Mismos datos que la página oficial, que es la referencia.
- Mapa: [MapLibre GL JS](https://maplibre.org) (licencia BSD-3-Clause).

---

_aguajalisco · proyecto comunitario · Guadalajara, Jalisco · 2026_
