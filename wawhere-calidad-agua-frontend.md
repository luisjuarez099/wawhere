# wawhere · Calidad del agua y comentario en el reporte

`wawhere-api` ya acepta tres campos nuevos en `POST /api/reports`: **`quality`**, **`quality_other`** y **`comment`**. Este documento explica qué hay que cambiar en el frontend para enviarlos, y cómo debe verse y comportarse el flujo según el diseño **"aguajalisco — flujo de reporte"** (4 pantallas: *Mapa y colonia seleccionada*, *Nuevo reporte*, *Detalles opcionales* y *Confirmación*).

El backend ya está listo y probado. Todos los cambios son de este repo, salvo los marcados como **requiere backend** en la sección 8.

---

## Resumen

| # | Cambio | Archivos |
|---|---|---|
| 1 | Tipos nuevos (`ReportQuality`, campos en `ReportCreate` y `Report`) | `src/map/types.ts` |
| 2 | Constantes de calidad (valores, etiquetas del diseño, límites) | `src/map/config.ts` |
| 3 | `ApiError` con el `detail` de la respuesta | `src/map/api.ts` |
| 4 | Sistema visual del diseño: tokens, tipografía, componentes | `src/map/map.css`, `mapa/index.html` |
| 5 | Hoja de reporte en 3 pasos: *Nuevo reporte → Detalles → Confirmación* | `mapa/index.html`, `src/map/main.ts` |
| 6 | Diseño responsivo (teléfono, teléfono horizontal, tablet/escritorio) | `src/map/map.css` |
| 7 | Mensajes de error para los `422` nuevos | `src/map/main.ts` |
| 8 | Partes del diseño que **requieren backend** (no bloquean esta entrega) | — |

---

## Contrato de la API

`POST /api/reports`:

```json
{
  "colonia_id": 636,
  "status": "baja",
  "quality": ["turbia", "otro"],
  "quality_other": "sabe a cloro",
  "comment": "Desde la mañana sale con poca presión"
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `colonia_id` | `number` | sí | Sin cambios |
| `status` | `'no' \| 'baja' \| 'ok'` | sí | Sin cambios |
| `quality` | `('mal_olor' \| 'turbia' \| 'sedimentos' \| 'otro')[]` | no (default `[]`) | Máximo 4 y sin repetidos. **Debe ir vacío si `status` es `'no'`** |
| `quality_other` | `string` | no | Máximo 80 caracteres. **Solo se acepta si `quality` incluye `'otro'`** |
| `comment` | `string` | no | Máximo 280 caracteres |

- **Textos:** la API recorta los espacios, y un texto vacío o solo con espacios se guarda como `null`. Puedes mandar `""` sin problema.

**Respuesta `201`:** ahora incluye `quality`. **No** incluye `quality_other` ni `comment`, porque el texto libre se guarda para análisis y nunca se devuelve ni se transmite al mapa.

```json
{ "id": "…", "status": "baja", "colonia_id": 636, "quality": ["turbia", "otro"], "created_at": "…" }
```

**Errores:**

| Status | `detail` | Cuándo |
|---|---|---|
| `422` | `"Colonia no válida o fuera de la ZMG"` (**string**) | La colonia no existe o está fuera de los municipios permitidos |
| `422` | Arreglo de errores de Pydantic (**array**) | Calidad con `status: 'no'`, `quality_other` sin `'otro'`, `'otro'` sin descripción, valor de calidad desconocido o texto demasiado largo |
| `429` | `{"error": "Rate limit exceeded: …"}` | Más de 3 reportes por minuto o 20 por hora desde la misma IP |

**Sin cambios:**
- `GET /api/reports/resumen` y el mensaje `colonia_update` del WebSocket **no traen datos de calidad**. El mapa sigue mostrando solo conteos por estado.
- Las partes del diseño que muestran calidad en el mapa están en la sección 8.

---

## 1. Tipos

`src/map/types.ts`:

```ts
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
```

---

## 2. Constantes

`src/map/config.ts`. Las etiquetas son las del diseño (pantalla *Nuevo reporte*):

```ts
import type { ReportQuality, ReportStatus } from './types'

// Si ya existe un mapa de etiquetas de estado, reutilízalo
export const STATUS_LABELS: Record<ReportStatus, string> = {
  ok: 'Con agua',
  baja: 'Baja presión',
  no: 'Sin agua',
}

// Orden en que se muestran los chips
export const QUALITY_ORDER: ReportQuality[] = ['mal_olor', 'turbia', 'sedimentos', 'otro']

export const QUALITY_LABELS: Record<ReportQuality, string> = {
  mal_olor: 'Mal olor',
  turbia: 'Turbia',
  sedimentos: 'Sedimentos o color extraño',
  otro: 'Otro',
}

// Deben coincidir con max_length en wawhere-api/app/schemas/report.py
export const QUALITY_OTHER_MAX = 80
export const COMMENT_MAX = 280
```

---

## 3. `ApiError` con el detalle

Ahora hay dos tipos de `422`, y conviene distinguirlos. En `src/map/api.ts`, guarda el `detail` de la respuesta:

```ts
/** Error HTTP de la API, con el status y el detail para mostrar un mensaje específico. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly detail?: unknown) {
    super(message)
  }
}

export async function createReport(body: ReportCreate): Promise<Report> {
  const res = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().then((b) => b?.detail, () => undefined)
    throw new ApiError(res.status, `POST /api/reports → ${res.status}`, detail)
  }
  return res.json()
}
```

---

## 4. Sistema visual del diseño

Todo lo nuevo debe usar estos valores, tomados del diseño. Si `map.css` ya define variables equivalentes, mapea estas a las existentes en lugar de duplicarlas.

### 4.1 Tipografía

| Uso | Fuente | Peso | Tamaño |
|---|---|---|---|
| Logo, títulos de hoja ("Nuevo reporte", nombre de colonia) | Bricolage Grotesque | 700 | 22 px (confirmación: 28 px) |
| Etiquetas de pregunta ("¿Cómo está el agua?") | Public Sans | 600 | 16 px (en *Detalles*: 15 px) |
| Botones de estado, botones principales | Public Sans | 600 | 14 px / 17 px |
| Chips de calidad | Public Sans | 500 (600 marcado) | 14 px |
| Textos de ayuda y avisos | Public Sans | 400 | 12 px |

En `mapa/index.html`, dentro de `<head>` (si la landing ya las carga, no las dupliques):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Public+Sans:wght@400;500;600&display=swap"
/>
```

### 4.2 Tokens

`src/map/map.css`:

```css
:root {
  /* Marca y texto */
  --c-primary: #145C8F;
  --c-primary-hover: #0E4268;
  --c-ink: #10232F;
  --c-muted: #4A5B66;

  /* Bordes y superficies */
  --c-border: #D9E1E5;
  --c-border-strong: #B9C6CD;
  --c-surface: #FFFFFF;
  --c-surface-tint: #EEF4F8;   /* tarjeta de colonia, estado elegido */
  --c-surface-muted: #F1F4F6;  /* botón cerrar, avisos */
  --c-surface-soft: #F8FAFB;   /* tarjeta de confirmación */
  --c-success-bg: #E3EFF7;     /* círculo del check */

  /* Estado del suministro (mismos colores que el mapa) */
  --c-ok: #2F8BC9;
  --c-baja: #C47A12;
  --c-no: #8A2B1A;
  --c-no-bg: #F6E3DF;

  /* Calidad (naranja: distinto de los colores de suministro) */
  --c-q-accent: #B4530F;
  --c-q-bg: #FBEBDD;
  --c-q-text: #8A3B0B;

  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-body: 'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;

  --r-sheet: 22px;
  --r-card: 14px;
  --r-input: 12px;
  --r-pill: 22px;

  --tap: 44px;          /* mínimo táctil de todo el flujo */
  --btn-primary-h: 56px;

  --shadow-sheet: 0 -4px 20px rgba(16, 35, 47, 0.15);
  --shadow-float: 0 2px 10px rgba(16, 35, 47, 0.12);
  --overlay: rgba(16, 35, 47, 0.55);
}
```

### 4.3 Reglas de diseño que no se deben romper

- **Objetivos táctiles de 44 px como mínimo.** Botones de estado: 88 px de alto. Botón principal: 56 px.
- **Los colores de suministro solo significan suministro** (azul, ámbar, rojo oscuro). La calidad siempre usa la familia naranja (`--c-q-*`), para que nunca se confunda "turbia" con "baja presión".
- **El color nunca es la única señal.** Cada estado lleva su texto; los chips marcados llevan "✓" además del color.
- **Un solo botón principal por pantalla** ("Enviar reporte" o "Avisar a mis vecinos").
- **Avisos de privacidad visibles donde se pide información**, con el texto exacto del diseño (secciones 5.2 y 5.3).

---

## 5. Flujo de reporte (según el diseño)

### Qué cambia respecto a hoy

**Hoy:** tocar *Sin agua / Baja presión / Con agua* envía el reporte al instante.

**Con el diseño:** tocar un estado **lo selecciona**, y el reporte se envía con **"Enviar reporte"**. Esto permite agregar calidad en la misma pantalla sin pasos extra. El reporte mínimo sigue siendo rápido: elegir estado → *Enviar reporte* (dos toques, con la colonia ya detectada).

```
Mapa (pantalla 1)
  └─ "Reportar en esta colonia" / "Reportar aquí"
       └─ Nuevo reporte (pantalla 2) ──"Agregar detalles"──► Detalles (pantalla 3)
             │                         ◄──── volver ─────────┘
             └─ "Enviar reporte" (desde 2 o desde 3)
                    └─ Confirmación (pantalla 4) ──"Volver al mapa"──► Mapa
```

Las pantallas 2, 3 y 4 son **pasos de un mismo formulario** dentro de una hoja (`#report-panel`), no páginas distintas. Así la selección se conserva al ir y volver de *Detalles*.

**Quita** los listeners actuales que envían el reporte al tocar un botón de estado.

### 5.1 Comportamiento

| Situación | Qué pasa |
|---|---|
| Se abre la hoja | Ningún estado viene seleccionado (para no sesgar reportes). "Enviar reporte" está deshabilitado |
| Elige **Con agua** o **Baja presión** | Aparece "¿Notas algo en el agua?" con los 4 chips |
| Elige **Sin agua** | La pregunta de calidad se oculta y se deshabilita; los chips marcados no se envían. Si luego cambia a otro estado, sus chips vuelven a aparecer como estaban |
| Marca **Otro** | El botón "Agregar detalles" cambia a **"Describe “Otro”"** con borde naranja. En *Detalles* aparece "¿Qué otra cosa notas?" |
| Envía con **Otro** marcado y sin descripción | No se llama a la API: se abre *Detalles*, se pone el foco en el campo y se muestra "Cuéntanos qué otra cosa notas o desmarca “Otro”." |
| Desmarca **Otro** | El campo se oculta y `quality_other` no se envía (evita el `422`) |
| Escribe un comentario | El contador "N / 280" se actualiza en vivo |
| Enviando | El botón dice "Enviando…" y todo el formulario queda deshabilitado |
| Éxito | Paso *Confirmación* con el resumen de lo enviado |
| Error | Mensaje bajo el botón (sección 7); la selección se conserva |
| Cerrar (✕ o tecla Esc) | Se cierra la hoja y se reinicia el formulario |

### 5.2 Paso *Nuevo reporte* (pantalla 2)

Contenido, de arriba abajo:

1. Encabezado: **"Nuevo reporte"** + botón cerrar (44 × 44, fondo `--c-surface-muted`, radio 12).
2. **Tarjeta de colonia** (fondo `--c-surface-tint`, radio 14): ícono de pin + nombre + botón **"Cambiar"**. Debajo: *"Detectada con tu ubicación. Solo la usamos para encontrar la colonia y no se guarda."* Si la colonia se eligió con el buscador y no con GPS, el texto cambia a *"Elegida en el buscador."*
3. **"¿Cómo está el agua?"**: 3 tarjetas en una fila (88 px de alto, radio 14), cada una con un punto de 16 px en su color. Seleccionada: borde `--c-primary` de 2 px y fondo `--c-surface-tint`.
4. **"¿Notas algo en el agua?"** con "Opcional · varias" a la derecha: chips de 44 px, radio 22. Marcado: borde `--c-q-accent` de 2 px, fondo `--c-q-bg`, texto `--c-q-text`, peso 600 y "✓" al inicio.
5. **"Agregar detalles (opcional)"**: botón de 52 px con borde punteado `--c-border-strong`.
6. Espacio flexible y **"Enviar reporte"** fijo abajo (56 px, fondo `--c-primary`).

> En el diseño aparece la nota *"Esta pregunta solo aparece si elegiste “Con agua” o “Baja presión”"*. Es una nota para desarrollo, **no** se muestra en la interfaz.

### 5.3 Paso *Detalles* (pantalla 3)

1. Botón de regreso con el resumen de lo elegido: **"‹ Las Águilas · Con agua · Turbia"** (se arma con `STATUS_LABELS` y `QUALITY_LABELS`).
2. Título **"Detalles (opcional)"**.
3. **"¿Qué otra cosa notas?"**: solo si *Otro* está marcado. Input de 48 px, radio 12, placeholder *"Ej. sabe mucho a cloro"*, `maxlength="80"`.
4. **"Comentario"**: textarea de 4 líneas, placeholder *"¿Desde cuándo? ¿Algo más que ayude a entender la situación?"*, `maxlength="280"`. Debajo, en una fila: *"No pongas nombres ni direcciones."* a la izquierda y el contador *"0 / 280"* a la derecha.
5. Aviso con fondo `--c-surface-muted`: *"Los comentarios no se publican: nos ayudan a mejorar las categorías del mapa."*
6. **"Enviar reporte"** (el mismo botón; se puede enviar desde aquí).

> **Foto:** el diseño la marca como *Fase 2*. **No se implementa ahora** y no se muestra: un botón que no hace nada confunde. Cuando se haga, necesita backend (subida, quitar EXIF/ubicación y moderación, como dice el diseño).

### 5.4 Paso *Confirmación* (pantalla 4)

1. Círculo de 88 px (fondo `--c-success-bg`) con check en `--c-primary`.
2. **"Tu reporte se sumó"** (Bricolage 700, 28 px) y debajo el resumen: *"Las Águilas · Con agua · Turbia"*, armado con **la respuesta del `201`** (`status` y `quality`), no con el formulario.
3. Tarjeta **"Calidad en tu colonia"** con la barra de progreso *"2 de 3 reportes…"*: **requiere backend** (sección 8). Mientras tanto, **no se muestra**.
4. **"Avisar a mis vecinos"** (botón principal): Web Share API; si no existe, copia el enlace y muestra "Enlace copiado".
5. **"Volver al mapa"** (botón secundario con borde `--c-border-strong`).

> La línea *"Puedes volver a reportar en esta colonia en 4 horas"* **no se muestra**: el backend no tiene esa regla (solo límite por IP de 3/min y 20/h). Ver sección 8.

### 5.5 HTML

`mapa/index.html`. Reemplaza el contenido actual de `#report-panel`. Los estados y los chips son **inputs nativos** (`radio` y `checkbox`) con apariencia de tarjeta y chip: así funcionan con teclado y lectores de pantalla sin código extra, y `FormData` los lee directo.

```html
<div class="sheet-backdrop" id="report-backdrop" hidden></div>

<section class="sheet" id="report-panel" role="dialog" aria-modal="true" aria-labelledby="report-title" hidden>
  <form class="sheet-form" id="report-form" novalidate>
    <div class="sheet-body">

      <!-- Paso 1 · Nuevo reporte -->
      <div class="sheet-step" data-step="main">
        <header class="sheet-header">
          <h2 class="sheet-title" id="report-title" tabindex="-1">Nuevo reporte</h2>
          <button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="colonia-card">
          <div class="colonia-card-row">
            <span class="colonia-card-name">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
              <span id="report-colonia"></span>
            </span>
            <button type="button" class="link-btn" data-action="change-colonia">Cambiar</button>
          </div>
          <p class="hint" id="report-colonia-hint">Detectada con tu ubicación. Solo la usamos para encontrar la colonia y no se guarda.</p>
        </div>

        <fieldset class="field">
          <legend class="field-label">¿Cómo está el agua?</legend>
          <div class="status-grid">
            <label class="status-option">
              <input class="sr-input" type="radio" name="status" value="ok" />
              <span class="status-dot" style="--dot: var(--c-ok)" aria-hidden="true"></span>Con agua
            </label>
            <label class="status-option">
              <input class="sr-input" type="radio" name="status" value="baja" />
              <span class="status-dot" style="--dot: var(--c-baja)" aria-hidden="true"></span>Baja presión
            </label>
            <label class="status-option">
              <input class="sr-input" type="radio" name="status" value="no" />
              <span class="status-dot" style="--dot: var(--c-no)" aria-hidden="true"></span>Sin agua
            </label>
          </div>
        </fieldset>

        <fieldset class="field" id="quality-field" hidden disabled>
          <legend class="field-label">
            ¿Notas algo en el agua? <span class="field-meta">Opcional · varias</span>
          </legend>
          <div class="chips">
            <label class="chip"><input class="sr-input" type="checkbox" name="quality" value="mal_olor" />Mal olor</label>
            <label class="chip"><input class="sr-input" type="checkbox" name="quality" value="turbia" />Turbia</label>
            <label class="chip"><input class="sr-input" type="checkbox" name="quality" value="sedimentos" />Sedimentos o color extraño</label>
            <label class="chip"><input class="sr-input" type="checkbox" name="quality" value="otro" />Otro</label>
          </div>
        </fieldset>

        <button type="button" class="details-btn" data-action="details">
          <span id="details-btn-label">Agregar detalles (opcional)</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </div>

      <!-- Paso 2 · Detalles -->
      <div class="sheet-step" data-step="details" hidden>
        <button type="button" class="back-btn" data-action="back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
          <span id="report-breadcrumb"></span>
        </button>

        <h2 class="sheet-title" tabindex="-1">Detalles (opcional)</h2>

        <div class="field" id="quality-other-field" hidden>
          <label class="field-label field-label--sm" for="quality-other">¿Qué otra cosa notas?</label>
          <input class="input" id="quality-other" name="quality_other" type="text" maxlength="80"
                 placeholder="Ej. sabe mucho a cloro" autocomplete="off" disabled />
        </div>

        <div class="field">
          <label class="field-label field-label--sm" for="comment">Comentario</label>
          <textarea class="textarea" id="comment" name="comment" rows="4" maxlength="280"
                    placeholder="¿Desde cuándo? ¿Algo más que ayude a entender la situación?"
                    aria-describedby="comment-hint comment-count"></textarea>
          <div class="field-foot">
            <span id="comment-hint">No pongas nombres ni direcciones.</span>
            <span id="comment-count">0 / 280</span>
          </div>
        </div>

        <p class="notice">Los comentarios no se publican: nos ayudan a mejorar las categorías del mapa.</p>
      </div>

      <!-- Paso 3 · Confirmación -->
      <div class="sheet-step sheet-step--done" data-step="done" hidden>
        <div class="done-icon" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
        </div>
        <div class="done-text">
          <h2 class="sheet-title sheet-title--lg" tabindex="-1">Tu reporte se sumó</h2>
          <p class="done-summary" id="done-summary"></p>
        </div>
        <!-- Tarjeta "Calidad en tu colonia": ver sección 8, oculta hasta que exista en backend -->
        <div class="done-actions">
          <button type="button" class="btn-primary" data-action="share">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>
            Avisar a mis vecinos
          </button>
          <button type="button" class="btn-secondary" data-action="close">Volver al mapa</button>
          <p class="form-msg form-msg--ok" id="done-msg" role="status" aria-live="polite"></p>
        </div>
      </div>
    </div>

    <footer class="sheet-footer" id="report-footer">
      <p class="form-msg" id="report-msg" role="status" aria-live="polite"></p>
      <button type="submit" class="btn-primary" id="report-submit" disabled>Enviar reporte</button>
    </footer>
  </form>
</section>
```

> **Ícono del botón "Agregar detalles":** el diseño usa una flecha hacia abajo, pero como abre otro paso (no despliega contenido), se usa una flecha a la derecha para que la acción sea clara. Si prefieren respetar el ícono del diseño, solo cambia el `path` a `M6 9l6 6 6-6`.

### 5.6 TypeScript

`src/map/main.ts`. Adapta los nombres a lo que ya existe (`colonia`, `LocationError`, la apertura actual del panel):

```ts
import { createReport, ApiError } from './api'
import { COMMENT_MAX, QUALITY_LABELS, STATUS_LABELS } from './config'
import type { Report, ReportCreate, ReportQuality, ReportStatus } from './types'

type Step = 'main' | 'details' | 'done'
type ReportFields = Omit<ReportCreate, 'colonia_id'>

const panel = document.querySelector<HTMLElement>('#report-panel')!
const backdrop = document.querySelector<HTMLElement>('#report-backdrop')!
const form = panel.querySelector<HTMLFormElement>('#report-form')!
const footer = panel.querySelector<HTMLElement>('#report-footer')!
const submitBtn = panel.querySelector<HTMLButtonElement>('#report-submit')!
const msg = panel.querySelector<HTMLElement>('#report-msg')!
const qualityField = panel.querySelector<HTMLFieldSetElement>('#quality-field')!
const otherField = panel.querySelector<HTMLElement>('#quality-other-field')!
const otherInput = panel.querySelector<HTMLInputElement>('#quality-other')!
const commentInput = panel.querySelector<HTMLTextAreaElement>('#comment')!
const commentCount = panel.querySelector<HTMLElement>('#comment-count')!
const detailsBtn = panel.querySelector<HTMLButtonElement>('[data-action="details"]')!
const detailsLabel = panel.querySelector<HTMLElement>('#details-btn-label')!
const breadcrumb = panel.querySelector<HTMLElement>('#report-breadcrumb')!
const coloniaName = panel.querySelector<HTMLElement>('#report-colonia')!
const coloniaHint = panel.querySelector<HTMLElement>('#report-colonia-hint')!
const doneSummary = panel.querySelector<HTMLElement>('#done-summary')!
const doneMsg = panel.querySelector<HTMLElement>('#done-msg')!

let current: { id: number; nombre: string } | null = null
let sending = false
let opener: HTMLElement | null = null

// ─── Lectura del formulario ───

function readForm(): ReportFields | null {
  const data = new FormData(form)
  const status = data.get('status') as ReportStatus | null
  if (!status) return null
  // Con el fieldset deshabilitado, FormData ya omite los chips; el filtro es por si acaso
  const quality = status === 'no' ? [] : (data.getAll('quality') as ReportQuality[])
  return {
    status,
    quality,
    // Solo se manda si "otro" está marcado; si no, la API responde 422
    quality_other: quality.includes('otro') ? String(data.get('quality_other') ?? '').trim() : undefined,
    comment: String(data.get('comment') ?? ''),
  }
}

function summary(status: ReportStatus, quality: ReportQuality[] = []): string {
  return [current?.nombre, STATUS_LABELS[status], ...quality.map((q) => QUALITY_LABELS[q])]
    .filter(Boolean)
    .join(' · ')
}

// ─── Estado visual ───

function sync(): void {
  const r = readForm()
  const canHaveQuality = r?.status === 'ok' || r?.status === 'baja'
  qualityField.hidden = !canHaveQuality
  qualityField.disabled = !canHaveQuality

  const hasOtro = !!r?.quality?.includes('otro')
  otherField.hidden = !hasOtro
  otherInput.disabled = !hasOtro || sending
  detailsBtn.toggleAttribute('data-attention', hasOtro && !r?.quality_other)
  detailsLabel.textContent = hasOtro ? 'Describe “Otro”' : 'Agregar detalles (opcional)'

  breadcrumb.textContent = r ? summary(r.status, r.quality) : current?.nombre ?? ''
  commentCount.textContent = `${commentInput.value.length} / ${COMMENT_MAX}`
  submitBtn.disabled = !r || sending
}

function showStep(step: Step): void {
  panel.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => {
    el.hidden = el.dataset.step !== step
  })
  panel.dataset.step = step
  footer.hidden = step === 'done'
  panel.querySelector<HTMLElement>(`[data-step="${step}"] .sheet-title`)?.focus()
}

function setMsg(text: string): void {
  msg.textContent = text
}

function setSending(value: boolean): void {
  sending = value
  form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>('input, textarea, button')
    .forEach((el) => { if (el !== submitBtn) el.disabled = value })
  submitBtn.textContent = value ? 'Enviando…' : 'Enviar reporte'
  sync() // vuelve a aplicar los disabled que dependen del estado
}

// ─── Abrir y cerrar ───

export function openReport(
  colonia: { id: number; nombre: string },
  source: 'gps' | 'search',
  trigger?: HTMLElement,
): void {
  current = colonia
  opener = trigger ?? null
  form.reset()
  setMsg('')
  doneMsg.textContent = ''
  coloniaName.textContent = colonia.nombre
  coloniaHint.textContent = source === 'gps'
    ? 'Detectada con tu ubicación. Solo la usamos para encontrar la colonia y no se guarda.'
    : 'Elegida en el buscador.'
  panel.hidden = false
  backdrop.hidden = false
  document.body.classList.add('sheet-open')
  sync()
  showStep('main')
}

function closeReport(): void {
  panel.hidden = true
  backdrop.hidden = true
  document.body.classList.remove('sheet-open')
  form.reset()
  opener?.focus() // devuelve el foco a quien abrió la hoja
}

// ─── Eventos ───

form.addEventListener('input', sync)
form.addEventListener('change', () => { setMsg(''); sync() })

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const fields = readForm()
  if (!fields || !current || sending) return

  if (fields.quality?.includes('otro') && !fields.quality_other) {
    showStep('details')
    otherInput.focus()
    setMsg('Cuéntanos qué otra cosa notas o desmarca “Otro”.')
    return
  }

  setSending(true)
  try {
    const saved: Report = await createReport({ colonia_id: current.id, ...fields })
    doneSummary.textContent = summary(saved.status, saved.quality)
    showStep('done')
  } catch (err) {
    setMsg(errorMessage(err))
  } finally {
    setSending(false)
  }
})

panel.addEventListener('click', (e) => {
  const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
  if (!action) return
  if (action === 'close') closeReport()
  if (action === 'details') showStep('details')
  if (action === 'back') showStep('main')
  if (action === 'share') void shareReport()
  if (action === 'change-colonia') {
    closeReport()
    openColoniaSearch() // usa la búsqueda que ya existe
  }
})

backdrop.addEventListener('click', () => { if (!sending) closeReport() })
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !panel.hidden && !sending) closeReport()
})

// ─── Compartir ───

async function shareReport(): Promise<void> {
  // Solo el nombre de la colonia: nunca coordenadas ni datos del reporte individual
  const url = `${location.origin}/mapa/`
  const text = `Reporté cómo está el agua en ${current?.nombre}. ¿Cómo está en tu casa?`
  if (navigator.share) {
    try { await navigator.share({ title: 'aguajalisco', text, url }) } catch { /* cancelado */ }
    return
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    doneMsg.textContent = 'Enlace copiado'
  } catch {
    doneMsg.textContent = 'No se pudo copiar el enlace.'
  }
}
```

**Detalles de implementación:**
- `openReport()` se llama desde **"Reportar en esta colonia"** (hoja de la colonia) con `source: 'search'` o `'gps'` según cómo se eligió, y desde **"Reportar aquí"** con `'gps'`. Pasa el botón como `trigger` para devolverle el foco al cerrar.
- Si tienen *deep link* por colonia (por ejemplo `?colonia=636`), úsalo en `shareReport()` para que el vecino llegue directo a esa colonia.

---

## 6. Estilos y responsivo

`src/map/map.css`. Los componentes siguen el diseño a 390 px (teléfono). En pantallas grandes la hoja deja de ser de pantalla completa y se vuelve un panel lateral, para que el mapa siga visible.

### 6.1 Componentes

```css
/* ─── Hoja ─── */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: var(--overlay);
}

.sheet {
  position: fixed;
  inset: max(48px, env(safe-area-inset-top)) 0 0;
  z-index: 21;
  display: flex;
  flex-direction: column;
  background: var(--c-surface);
  color: var(--c-ink);
  font-family: var(--font-body);
  border-radius: var(--r-sheet) var(--r-sheet) 0 0;
  box-shadow: var(--shadow-sheet);
}

.sheet[hidden],
.sheet-backdrop[hidden],
.sheet-step[hidden],
.field[hidden],
.sheet-footer[hidden] { display: none; }

body.sheet-open { overflow: hidden; } /* evita que el mapa se mueva detrás */

.sheet-form { display: flex; flex-direction: column; flex: 1; min-height: 0; }

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px 20px;
}

.sheet-step { display: flex; flex-direction: column; gap: 20px; }
.sheet-step[data-step='details'] { gap: 18px; }

.sheet-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 20px calc(16px + env(safe-area-inset-bottom));
  background: var(--c-surface);
}

.sheet-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.sheet-title {
  margin: 0;
  font: 700 22px/1.2 var(--font-display);
}
.sheet-title--lg { font-size: 28px; }
.sheet-title:focus { outline: none; }

/* ─── Botones base ─── */
.icon-btn {
  width: var(--tap);
  height: var(--tap);
  flex: none;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 12px;
  background: var(--c-surface-muted);
  color: var(--c-ink);
  cursor: pointer;
}

.link-btn {
  height: var(--tap);
  padding: 0 8px;
  border: 0;
  background: none;
  color: var(--c-primary);
  font: 600 14px var(--font-body);
  cursor: pointer;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: var(--tap);
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-ink);
  font: 600 15px var(--font-body);
  text-align: left;
  cursor: pointer;
}

.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border-radius: var(--r-card);
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
}
.btn-primary {
  height: var(--btn-primary-h);
  border: 0;
  background: var(--c-primary);
  color: #fff;
  font-size: 17px;
}
.btn-primary:hover:not(:disabled) { background: var(--c-primary-hover); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-secondary {
  height: 52px;
  border: 1px solid var(--c-border-strong);
  background: var(--c-surface);
  color: var(--c-ink);
  font-size: 16px;
}

:is(.icon-btn, .link-btn, .back-btn, .btn-primary, .btn-secondary, .details-btn):focus-visible {
  outline: 3px solid var(--c-primary);
  outline-offset: 2px;
}

/* ─── Tarjeta de colonia ─── */
.colonia-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--r-card);
  background: var(--c-surface-tint);
}
.colonia-card-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.colonia-card-name { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 600; font-size: 16px; }
.colonia-card-name > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.hint { margin: 0; font-size: 12px; color: var(--c-muted); }

/* ─── Campos ─── */
.field { display: flex; flex-direction: column; gap: 10px; min-width: 0; margin: 0; padding: 0; border: 0; }

.field-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 0;
  font-weight: 600;
  font-size: 16px;
}
.field-label--sm { font-size: 15px; }
.field-meta { font-size: 12px; font-weight: 400; color: var(--c-muted); }

/* Input visualmente oculto, pero accesible y enfocable */
.sr-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

/* ─── Botones de estado ─── */
.status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }

.status-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 88px;
  padding: 8px 4px;
  border: 1px solid var(--c-border);
  border-radius: var(--r-card);
  background: var(--c-surface);
  font-weight: 600;
  font-size: 14px;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
}
/* box-shadow en vez de borde de 2 px, para que la tarjeta no "salte" al seleccionarla */
.status-option:has(input:checked) {
  border-color: var(--c-primary);
  box-shadow: inset 0 0 0 1px var(--c-primary);
  background: var(--c-surface-tint);
}
.status-option:has(input:focus-visible) { outline: 3px solid var(--c-primary); outline-offset: 2px; }
.status-option:has(input:disabled) { cursor: not-allowed; opacity: 0.6; }

.status-dot { width: 16px; height: 16px; border-radius: 50%; background: var(--dot); }

/* ─── Chips de calidad ─── */
.chips { display: flex; flex-wrap: wrap; gap: 8px; }

.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  padding: 0 14px;
  border: 1px solid var(--c-border);
  border-radius: var(--r-pill);
  background: var(--c-surface);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.chip:has(input:checked) {
  border-color: var(--c-q-accent);
  box-shadow: inset 0 0 0 1px var(--c-q-accent);
  background: var(--c-q-bg);
  color: var(--c-q-text);
  font-weight: 600;
}
.chip:has(input:checked)::before { content: '✓' / ''; margin-right: 6px; }
.chip:has(input:focus-visible) { outline: 3px solid var(--c-q-accent); outline-offset: 2px; }

/* ─── Botón "Agregar detalles" ─── */
.details-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 52px;
  padding: 0 14px;
  border: 1px dashed var(--c-border-strong);
  border-radius: var(--r-card);
  background: none;
  color: var(--c-ink);
  font: 500 15px var(--font-body);
  text-align: left;
  cursor: pointer;
}
.details-btn[data-attention] {
  border-style: solid;
  border-color: var(--c-q-accent);
  color: var(--c-q-text);
  font-weight: 600;
}

/* ─── Inputs ─── */
.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--r-input);
  background: var(--c-surface);
  color: var(--c-ink);
  /* 16 px y no 15 px como en el diseño: con menos, iOS hace zoom al enfocar */
  font: 16px/1.4 var(--font-body);
}
.input { height: 48px; padding: 0 14px; }
.textarea { min-height: 112px; padding: 12px 14px; resize: none; }
.input:focus-visible,
.textarea:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 1px; border-color: var(--c-primary); }
.input::placeholder,
.textarea::placeholder { color: #7A8A94; }

.field-foot { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--c-muted); }

.notice {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--r-input);
  background: var(--c-surface-muted);
  font-size: 12px;
  color: var(--c-muted);
}

.form-msg { margin: 0; font-size: 14px; color: var(--c-no); text-align: center; }
.form-msg--ok { color: var(--c-primary); }
.form-msg:empty { display: none; }

/* ─── Confirmación ─── */
.sheet-step--done { min-height: 100%; padding-top: 48px; gap: 24px; }

.done-icon {
  align-self: center;
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--c-success-bg);
}
.done-text { display: flex; flex-direction: column; gap: 8px; text-align: center; }
.done-summary { margin: 0; font-size: 15px; color: var(--c-muted); }
.done-actions { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }

/* ─── Animación (solo si el usuario no pidió menos movimiento) ─── */
@media (prefers-reduced-motion: no-preference) {
  .sheet:not([hidden]) { animation: sheet-in 0.22s ease-out; }
  @keyframes sheet-in { from { transform: translateY(24px); opacity: 0; } }
}
```

### 6.2 Breakpoints

| Ancho / caso | Comportamiento |
|---|---|
| **< 360 px** (teléfonos chicos) | Igual que el diseño, con texto de estado a 13 px y menos padding lateral |
| **360–767 px** (teléfono, referencia del diseño a 390 px) | Hoja de pantalla completa que deja 48 px arriba con el mapa oscurecido; botón principal fijo abajo; el contenido hace scroll en medio |
| **Teléfono horizontal** (alto < 560 px) | La hoja ocupa todo el alto, sin radio superior; tarjetas de estado de 64 px |
| **≥ 768 px** (tablet y escritorio) | Panel flotante de 400 px a la izquierda; el mapa queda visible y sin oscurecer |

```css
@media (max-width: 359px) {
  .sheet-body { padding-inline: 16px; }
  .sheet-footer { padding-inline: 16px; }
  .status-option { font-size: 13px; }
}

@media (max-height: 559px) and (orientation: landscape) {
  .sheet { inset: 0; border-radius: 0; }
  .status-option { min-height: 64px; flex-direction: row; }
  .sheet-step--done { padding-top: 16px; }
}

@media (min-width: 768px) {
  .sheet-backdrop { display: none; }
  body.sheet-open { overflow: visible; }
  .sheet {
    inset: 16px auto auto 16px;
    width: 400px;
    max-height: calc(100dvh - 32px);
    border-radius: var(--r-sheet);
    box-shadow: 0 8px 32px rgba(16, 35, 47, 0.18);
  }
  .sheet-step--done { padding-top: 24px; }
}
```

**Notas:**
- En escritorio la hoja **no es modal visualmente** (sin fondo oscuro), pero sigue teniendo `role="dialog"`. Si quieren que el mapa sea interactivo mientras está abierta, quita `aria-modal="true"` en ≥ 768 px desde `openReport()`.
- El `ResizeObserver` que hoy mide `--panel-h` debe seguir apuntando a la **hoja de resumen de colonia** (pantalla 1), no a `#report-panel`, que es modal en teléfono y no debe empujar la atribución del mapa.
- Usa `100dvh` (no `100vh`) para que la barra del navegador en el teléfono no tape el botón "Enviar reporte".
- El diseño es solo en modo claro. No agregues modo oscuro en esta entrega.

---

## 7. Mensajes de error

`errorMessage()` en `src/map/main.ts` hoy trata cualquier `422` como "fuera de la ZMG". Distínguelos por el tipo de `detail`. El mensaje se muestra en `#report-msg`, justo encima de "Enviar reporte", y la selección del usuario se conserva:

```ts
function errorMessage(err: unknown): string {
  if (err instanceof LocationError) return err.message
  if (err instanceof ApiError && err.status === 422) {
    // detail string → colonia inválida; detail array → validación de campos
    return typeof err.detail === 'string'
      ? 'Esa colonia está fuera de la zona metropolitana de Guadalajara.'
      : 'Revisa la calidad del agua o el comentario e intenta de nuevo.'
  }
  if (err instanceof ApiError && err.status === 429) {
    return 'Enviaste varios reportes seguidos. Intenta de nuevo en unos minutos.'
  }
  return 'No se pudo enviar tu reporte. Revisa tu conexión e intenta de nuevo.'
}
```

Con el formulario bien armado, el segundo `422` no debería pasar nunca: *Sin agua* deshabilita los chips, `quality_other` solo se manda con *Otro* (y se exige antes de enviar), y los `maxlength` limitan el texto. El mensaje queda como red de seguridad.

---

## 8. Partes del diseño que requieren backend

Estas partes están en el diseño, pero **no se implementan en esta entrega** porque la API todavía no da los datos. Quedan documentadas para la siguiente.

| Elemento del diseño | Pantalla | Qué falta en el backend | Qué hacer mientras tanto |
|---|---|---|---|
| Selector **Suministro / Calidad** arriba del mapa | 1 | Conteos de calidad por colonia en `/resumen` y en `colonia_update` | No mostrar el selector |
| Bloque **"CALIDAD PERCIBIDA"** con chips "Agua turbia · 4" en la hoja de colonia | 1 | Lo mismo | No mostrar el bloque |
| Tarjeta **"Calidad en tu colonia · 2 de 3 reportes"** | 4 | Conteo de calidad de la colonia en la respuesta del `201` y un umbral mínimo | No mostrar la tarjeta |
| **"Puedes volver a reportar en esta colonia en 4 horas"** | 4 | Una regla de 1 reporte por colonia cada 4 h (hoy solo hay límite por IP: 3/min y 20/h) | No mostrar el texto |
| **Foto** del agua | 3 | Subida de archivos, borrar EXIF/ubicación y moderación | No mostrar el bloque |

**Sobre el umbral de 3 reportes:** debe aplicarse en el **backend**, no solo ocultarse en el frontend. Si la API manda el conteo de calidad aunque sea 1, cualquiera puede verlo en la red, y con un solo reporte en una colonia chica se puede intuir quién lo hizo. Es la misma lógica que ya se usa para no mostrar ubicaciones exactas.

**Texto de la ventana de tiempo:** el diseño dice *"Reportes ciudadanos · últimas 48 h"*, pero los reportes expiran en **7 días** (`REPORT_EXPIRY_HOURS`). El subtítulo debe usar el valor real (*"últimos 7 días"*), idealmente leído de la API o de `config.ts`, para no informar mal.

**Disclaimer:** cuando se muestre calidad en el mapa, incluir siempre el texto del diseño: *"Percepción reportada por vecinos, no es un análisis de laboratorio."*

---

## Comprobar

Con la API local (`uvicorn app.main:app --port 8000`, con `http://localhost:5173` en `CORS_ORIGINS`) y `npm run dev`:

**Flujo**
1. Al abrir la hoja no hay estado seleccionado y "Enviar reporte" está deshabilitado.
2. **Sin agua → Enviar:** se guarda con `quality = []`; la pregunta de calidad nunca aparece.
3. **Baja presión → Enviar** (sin tocar nada más): se guarda con `quality = []`.
4. **Con agua → Turbia + Otro → Describe “Otro” → "sabe a cloro" + comentario → Enviar:** se guarda todo; la confirmación dice *"Colonia · Con agua · Turbia · Otro"*.
5. **Marcar Otro y enviar sin escribir nada:** no hay petición a la API; se abre *Detalles* con el foco en el campo y el mensaje.
6. **Marcar Otro, escribir texto y desmarcar Otro → Enviar:** `quality_other` no se envía y la respuesta es `201`, no `422`.
7. **Con agua + Turbia → cambiar a Sin agua → Enviar:** se guarda sin calidad. Volver a *Con agua* muestra *Turbia* aún marcada.
8. **Ir a Detalles y volver:** la selección se conserva; el resumen del botón de regreso coincide con lo elegido.
9. **Colonia fuera de la ZMG:** aparece el mensaje de zona.
10. **Cuatro reportes en un minuto:** aparece el mensaje de `429`.
11. **Avisar a mis vecinos:** en el teléfono abre el menú de compartir; en escritorio copia el enlace.

**Diseño y responsivo**
12. Comparar lado a lado con el diseño a **390 × 844** (DevTools): colores, tipografías, tamaños y espaciados iguales.
13. **320 px de ancho:** sin scroll horizontal; "Sedimentos o color extraño" y "Baja presión" se acomodan sin cortarse.
14. **Teléfono horizontal:** "Enviar reporte" siempre visible.
15. **≥ 768 px:** panel lateral de 400 px con el mapa visible.
16. **iPhone real:** enfocar el comentario no hace zoom, y el teclado no tapa el botón de enviar.

**Accesibilidad**
17. Todo el flujo se puede hacer solo con teclado (Tab, flechas en los estados, Espacio en los chips, Esc para cerrar).
18. Con VoiceOver o TalkBack se anuncian "¿Cómo está el agua?", el estado seleccionado y los chips marcados.
19. Al cerrar, el foco vuelve al botón que abrió la hoja.

20. `npm run build` sin errores de TypeScript.

Para ver lo guardado:

```sql
SELECT status, quality, quality_other, comment, created_at
FROM reports ORDER BY created_at DESC LIMIT 5;
```

Después borra los reportes de prueba:

```sql
DELETE FROM reports WHERE created_at > now() - interval '15 minutes';
```

---

## Checklist

**Datos**
- [ ] `ReportQuality`, `Report.quality` y los campos opcionales de `ReportCreate` en `types.ts`
- [ ] `STATUS_LABELS`, `QUALITY_ORDER`, `QUALITY_LABELS` (textos del diseño), `QUALITY_OTHER_MAX` y `COMMENT_MAX` en `config.ts`
- [ ] `ApiError` guarda `detail`

**Diseño**
- [ ] Fuentes Bricolage Grotesque (600, 700) y Public Sans (400, 500, 600) cargadas
- [ ] Tokens de color, radios y tamaños en `map.css`
- [ ] Calidad usa solo la familia naranja; suministro solo azul, ámbar y rojo oscuro
- [ ] Todos los objetivos táctiles miden 44 px o más

**Flujo**
- [ ] Tocar un estado lo selecciona; ya no envía al instante
- [ ] "Enviar reporte" deshabilitado hasta elegir estado
- [ ] *Sin agua* oculta y deshabilita los chips de calidad
- [ ] Paso *Detalles* con "¿Qué otra cosa notas?" solo con *Otro*, comentario con contador y aviso de privacidad
- [ ] *Otro* sin descripción no se envía: lleva a *Detalles*
- [ ] Paso *Confirmación* armado con la respuesta del `201`, con "Avisar a mis vecinos" y "Volver al mapa"
- [ ] Sin foto, sin tarjeta de umbral y sin el texto de "4 horas" (sección 8)
- [ ] `errorMessage()` distingue los dos `422`

**Responsivo y accesibilidad**
- [ ] Hoja de pantalla completa en teléfono, panel lateral en ≥ 768 px
- [ ] Sin scroll horizontal a 320 px y botón de enviar visible en horizontal
- [ ] Inputs de 16 px (sin zoom en iOS)
- [ ] Navegable con teclado, Esc cierra, el foco vuelve al botón que abrió la hoja
- [ ] Probado en teléfono real
