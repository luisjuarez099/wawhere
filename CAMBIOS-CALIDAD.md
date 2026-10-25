# wawhere · Calidad del agua y comentario en el reporte

`wawhere-api` ya acepta tres campos nuevos en `POST /api/reports`: **`quality`**, **`quality_other`** y **`comment`**. Este documento explica qué hay que cambiar en el frontend para enviarlos.

El backend ya está listo y probado. Todos los cambios son de este repo.

---

## Resumen

| # | Cambio | Archivos |
|---|---|---|
| 1 | Tipos nuevos (`ReportQuality`, campos en `ReportCreate` y `Report`) | `src/map/types.ts` |
| 2 | Constantes de calidad (valores, etiquetas, límites) | `src/map/config.ts` |
| 3 | `ApiError` con el `detail` de la respuesta | `src/map/api.ts` |
| 4 | Paso opcional de calidad en el panel | `mapa/index.html`, `src/map/main.ts`, `src/map/map.css` |
| 5 | Mensajes de error para los `422` nuevos | `src/map/main.ts` |

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
| `422` | Arreglo de errores de Pydantic (**array**) | Calidad con `status: 'no'`, `quality_other` sin `'otro'`, valor de calidad desconocido o texto demasiado largo |
| `429` | `{"error": "Rate limit exceeded: …"}` | Más de 3 reportes por minuto o 20 por hora desde la misma IP |

**Sin cambios:**
- `GET /api/reports/resumen` y el mensaje `colonia_update` del WebSocket **no traen datos de calidad**. El mapa sigue mostrando solo conteos por estado.
- Si más adelante quieren mostrar la calidad en el mapa, hace falta un cambio en el backend.

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

`src/map/config.ts`:

```ts
import type { ReportQuality, ReportStatus } from './types'

export const QUALITY_LABELS: Record<ReportQuality, string> = {
  turbia: 'Turbia',
  mal_olor: 'Mal olor',
  sedimentos: 'Con sedimentos',
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

## 4. Paso opcional de calidad

**Hoy:** tocar *Sin agua / Baja presión / Con agua* envía el reporte al instante.

**Propuesta:**

- **Sin agua:** se envía igual que hoy. No hay calidad que preguntar, y la API la rechaza.
- **Baja presión** y **Con agua:** se abre un segundo paso **opcional** con:
  - casillas *Turbia*, *Mal olor*, *Con sedimentos* y *Otro*;
  - un campo de texto corto, visible solo si *Otro* está marcado;
  - un comentario opcional;
  - dos botones: **Enviar** y **Omitir**, que envía sin calidad.

Así el reporte básico sigue siendo "tres toques y listo", como promete la landing.

`mapa/index.html`, dentro de `#report-panel`, después de los botones de estado:

```html
<form class="report-quality" id="report-quality" hidden>
  <fieldset>
    <legend>¿Cómo sale el agua? <span class="optional">(opcional)</span></legend>
    <label><input type="checkbox" name="quality" value="turbia" /> Turbia</label>
    <label><input type="checkbox" name="quality" value="mal_olor" /> Mal olor</label>
    <label><input type="checkbox" name="quality" value="sedimentos" /> Con sedimentos</label>
    <label><input type="checkbox" name="quality" value="otro" /> Otro</label>
  </fieldset>

  <label class="report-quality-other" hidden>
    ¿Qué más notas?
    <input type="text" name="quality_other" maxlength="80" autocomplete="off" />
  </label>

  <label>
    Comentario <span class="optional">(opcional)</span>
    <textarea name="comment" maxlength="280" rows="2"></textarea>
  </label>
  <p class="report-quality-hint">No escribas datos personales. El comentario no se publica en el mapa.</p>

  <div class="report-quality-actions">
    <button type="button" data-action="skip">Omitir</button>
    <button type="submit">Enviar</button>
  </div>
</form>
```

`src/map/main.ts`. La idea es separar *elegir estado* de *enviar*. Adapta los nombres a lo que ya existe (`report`, `setReportEnabled`, `reportMsg`):

```ts
const qualityForm = document.querySelector<HTMLFormElement>('#report-quality')!
const qualityOtherField = qualityForm.querySelector<HTMLElement>('.report-quality-other')!
let pendingStatus: ReportStatus | null = null

function readQuality(): Pick<ReportCreate, 'quality' | 'quality_other' | 'comment'> {
  const data = new FormData(qualityForm)
  const quality = data.getAll('quality') as ReportQuality[]
  return {
    quality,
    // Solo se manda si "otro" está marcado; si no, la API responde 422
    quality_other: quality.includes('otro') ? String(data.get('quality_other') ?? '') : undefined,
    comment: String(data.get('comment') ?? ''),
  }
}

function closeQuality(): void {
  qualityForm.reset()
  qualityForm.hidden = true
  qualityOtherField.hidden = true
  pendingStatus = null
}

// El campo "¿Qué más notas?" solo aparece con "Otro" marcado
qualityForm.addEventListener('change', () => {
  qualityOtherField.hidden = !new FormData(qualityForm).getAll('quality').includes('otro')
})

qualityForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if (pendingStatus) void report(pendingStatus, readQuality())
})

qualityForm.querySelector('[data-action="skip"]')!.addEventListener('click', () => {
  if (pendingStatus) void report(pendingStatus)
})

reportButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    const status = btn.dataset.status as ReportStatus
    // Sin agua no lleva calidad: se envía directo
    if (status === 'no') return void report(status)
    pendingStatus = status
    qualityForm.hidden = false
  }),
)
```

Y `report()` recibe los extras y los manda:

```ts
async function report(
  status: ReportStatus,
  extra: Pick<ReportCreate, 'quality' | 'quality_other' | 'comment'> = {},
): Promise<void> {
  // ...igual que hoy...
  await createReport({ colonia_id: colonia.id, status, ...extra })
  closeQuality()
  // ...igual que hoy...
}
```

**Detalles:**
- Mientras el formulario está abierto, deshabilita sus botones durante el envío, igual que `setReportEnabled` hace con los de estado.
- Si el usuario toca otro estado con el formulario abierto, actualiza `pendingStatus`. Si toca *Sin agua*, ciérralo con `closeQuality()` y envía directo.
- Accesibilidad: al abrir el formulario, pon el foco en la primera casilla; al cerrarlo, devuélvelo al botón de estado.
- Estilos en `src/map/map.css`: el panel ya mide su altura con `ResizeObserver` (`--panel-h`), así que crecer no tapa la atribución. Revisa que en el teléfono quepa sin scroll horizontal.

---

## 5. Mensajes de error

`errorMessage()` en `src/map/main.ts` hoy trata cualquier `422` como "fuera de la ZMG". Distínguelos por el tipo de `detail`:

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
  return 'No se pudo enviar tu reporte. Intenta de nuevo.'
}
```

Con el formulario bien armado, el segundo `422` no debería pasar nunca: *Sin agua* no abre el formulario, `quality_other` solo se manda con *Otro* y los `maxlength` limitan el texto. El mensaje queda como red de seguridad.

---

## Comprobar

Con la API local (`uvicorn app.main:app --port 8000`, con `http://localhost:5173` en `CORS_ORIGINS`) y `npm run dev`:

1. **Sin agua:** envía al instante y no abre el formulario.
2. **Baja presión → Omitir:** se guarda con `quality = []`.
3. **Con agua → Turbia + Otro ("sabe a cloro") + comentario → Enviar:** se guarda todo.
4. **Marcar Otro, escribir texto y desmarcar Otro → Enviar:** `quality_other` no se envía y la respuesta es `201`, no `422`.
5. **Colonia fuera de la ZMG:** aparece el mensaje de zona.
6. **Cuatro reportes en un minuto:** aparece el mensaje de `429`.
7. `npm run build` sin errores de TypeScript.

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

- [ ] `ReportQuality`, `Report.quality` y los campos opcionales de `ReportCreate` en `types.ts`
- [ ] `QUALITY_LABELS`, `QUALITY_OTHER_MAX` y `COMMENT_MAX` en `config.ts`
- [ ] `ApiError` guarda `detail`
- [ ] Formulario de calidad en `mapa/index.html`, oculto por defecto
- [ ] *Sin agua* envía directo; *Baja presión* y *Con agua* abren el formulario
- [ ] `quality_other` solo se envía con *Otro* marcado
- [ ] `maxlength` 80 y 280 en los campos de texto
- [ ] Aviso de "no escribas datos personales" junto al comentario
- [ ] `errorMessage()` distingue los dos `422`
- [ ] Probado en teléfono: el panel no tapa el mapa ni genera scroll horizontal
