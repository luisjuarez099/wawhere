import { ApiError, createReport } from './api'
import { COMMENT_MAX, QUALITY_BUENA, QUALITY_LABELS, STATUS_LABELS } from './config'
import { LocationError } from './geolocation'
import type { Colonia, Report, ReportCreate, ReportQuality, ReportStatus } from './types'

// Hoja de reporte en 3 pasos: Nuevo reporte → Detalles (opcional) → Confirmación.
// Son pasos de un mismo formulario, así la selección se conserva al ir y volver.

type Step = 'main' | 'details' | 'done'
type ReportFields = Omit<ReportCreate, 'colonia_id'>

/** Cómo se eligió la colonia; cambia el texto bajo su nombre. */
export type ColoniaSource = 'gps' | 'map'

const COLONIA_HINTS: Record<ColoniaSource, string> = {
  gps: 'Detectada con tu ubicación. Solo la usamos para encontrar la colonia y no se guarda.',
  map: 'Elegida en el mapa.',
}

interface ReportSheetOptions {
  // Después de un 201: refrescar el mapa, limpiar la selección, etc.
  onSent: (report: Report, colonia: Colonia) => void
  // "Cambiar": la hoja ya se cerró; el usuario debe elegir otra colonia
  onChangeColonia: () => void
}

export function errorMessage(err: unknown): string {
  if (err instanceof LocationError) return err.message
  if (err instanceof ApiError && err.status === 422) {
    // detail string → colonia inválida; detail array → validación de campos
    return typeof err.detail === 'string'
      ? 'Esa colonia está fuera de la zona metropolitana de Guadalajara.'
      : 'Revisa la calidad del agua o el comentario e intenta de nuevo.'
  }
  if (err instanceof ApiError && err.status === 429) {
    return 'Ya enviaste un reporte desde esta conexión. Puedes reportar de nuevo en una hora.'
  }
  return 'No se pudo enviar tu reporte. Revisa tu conexión e intenta de nuevo.'
}

export function initReportSheet({ onSent, onChangeColonia }: ReportSheetOptions) {
  const panel = document.querySelector<HTMLElement>('#report-panel')!
  const backdrop = document.querySelector<HTMLElement>('#report-backdrop')!
  const form = panel.querySelector<HTMLFormElement>('#report-form')!
  const footer = panel.querySelector<HTMLElement>('#report-footer')!
  const submitBtn = panel.querySelector<HTMLButtonElement>('#report-submit')!
  const msg = panel.querySelector<HTMLElement>('#report-msg')!
  const qualityField = panel.querySelector<HTMLFieldSetElement>('#quality-field')!
  const otherField = panel.querySelector<HTMLElement>('#quality-other-field')!
  const buenaGroup = panel.querySelector<HTMLElement>('#quality-buena')!
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
  const desktop = window.matchMedia('(min-width: 768px)')

  let current: Colonia | null = null
  let sending = false
  let opener: HTMLElement | null = null

  // ─── Lectura del formulario ───

  function readStatus(): ReportStatus | null {
    return (new FormData(form).get('status') as ReportStatus | null) ?? null
  }

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
    // El fieldset se ajusta antes de leer: si estaba deshabilitado, FormData omitiría los chips
    const status = readStatus()
    const canHaveQuality = status === 'ok' || status === 'baja'
    qualityField.hidden = !canHaveQuality
    qualityField.disabled = !canHaveQuality || sending

    // "Limpia", "cristalina" y "sin olor" con "Con agua" o "Baja presión": al cambiar de estado se desmarcan
    const hayAgua = canHaveQuality
    buenaGroup.hidden = !hayAgua
    if (!hayAgua) {
      form.querySelectorAll<HTMLInputElement>('input[name="quality"]').forEach((input) => {
        if (QUALITY_BUENA.includes(input.value as ReportQuality)) input.checked = false
      })
    }

    const r = readForm()
    const hasOtro = !!r?.quality?.includes('otro')
    otherField.hidden = !hasOtro
    otherInput.disabled = !hasOtro || sending
    detailsBtn.toggleAttribute('data-attention', hasOtro && !r?.quality_other)
    detailsLabel.textContent = hasOtro ? 'Describe “Otro”' : 'Agregar detalles (opcional)'

    breadcrumb.textContent = r ? summary(r.status, r.quality) : (current?.nombre ?? '')
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
    form
      .querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>('input, textarea, button')
      .forEach((el) => {
        if (el !== submitBtn) el.disabled = value
      })
    submitBtn.textContent = value ? 'Enviando…' : 'Enviar reporte'
    sync() // vuelve a aplicar los disabled que dependen del estado
  }

  // ─── Abrir y cerrar ───

  function open(colonia: Colonia, source: ColoniaSource, trigger?: HTMLElement): void {
    current = colonia
    opener = trigger ?? null
    form.reset()
    setMsg('')
    doneMsg.textContent = ''
    coloniaName.textContent = colonia.nombre
    coloniaHint.textContent = COLONIA_HINTS[source]
    // En escritorio el mapa sigue visible y usable detrás del panel
    if (desktop.matches) panel.removeAttribute('aria-modal')
    else panel.setAttribute('aria-modal', 'true')
    panel.hidden = false
    backdrop.hidden = false
    document.body.classList.add('sheet-open')
    sync()
    showStep('main')
  }

  function close(): void {
    panel.hidden = true
    backdrop.hidden = true
    document.body.classList.remove('sheet-open')
    form.reset()
    opener?.focus() // devuelve el foco a quien abrió la hoja
  }

  // ─── Eventos ───

  form.addEventListener('input', sync)
  form.addEventListener('change', (e) => {
    const input = e.target
    // Buenas condiciones y problemas no van juntos: marcar uno desmarca los del otro grupo
    if (input instanceof HTMLInputElement && input.name === 'quality' && input.checked) {
      const buena = QUALITY_BUENA.includes(input.value as ReportQuality)
      form.querySelectorAll<HTMLInputElement>('input[name="quality"]').forEach((otro) => {
        if (otro !== input && QUALITY_BUENA.includes(otro.value as ReportQuality) !== buena) otro.checked = false
      })
    }
    setMsg('')
    sync()
  })

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
      const saved = await createReport({ colonia_id: current.id, ...fields })
      // El resumen sale de lo que guardó la API, no del formulario
      doneSummary.textContent = summary(saved.status, saved.quality)
      showStep('done')
      onSent(saved, current)
    } catch (err) {
      console.error(err)
      setMsg(errorMessage(err))
    } finally {
      setSending(false)
    }
  })

  panel.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
    if (!action) return
    if (action === 'close') close()
    if (action === 'details') showStep('details')
    if (action === 'back') showStep('main')
    if (action === 'share') void share()
    if (action === 'change-colonia') {
      opener = null // el foco no debe volver al botón de reportar: hay que elegir colonia
      close()
      onChangeColonia()
    }
  })

  backdrop.addEventListener('click', () => {
    if (!sending) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return
    e.preventDefault() // así la hoja de colonia, que queda debajo, no se cierra también
    if (!sending) close()
  })

  // ─── Compartir ───

  async function share(): Promise<void> {
    // Solo el nombre de la colonia: nunca coordenadas ni datos del reporte individual
    const url = `${location.origin}/mapa/`
    const text = `Reporté cómo está el agua en ${current?.nombre}. ¿Cómo está en tu casa?`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'aguajalisco', text, url })
      } catch {
        // cancelado por el usuario
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      doneMsg.textContent = 'Enlace copiado'
    } catch {
      doneMsg.textContent = 'No se pudo copiar el enlace.'
    }
  }

  return { open, close }
}
