import { getColoniaDetalle } from './api'
import { QUALITY_LABELS, QUALITY_ORDER, REPORT_EXPIRY_MS, STATUS_LABELS } from './config'
import type { Colonia, ColoniaComentario, ColoniaDetalle, ColoniaResumenProps, ReportStatus } from './types'

// Hoja informativa al tocar una colonia (pantalla 1 del diseño): suministro,
// calidad reportada y último reporte, con el botón para reportar ahí.

const TZ = 'America/Mexico_City'
const STATUS_ORDER: ReportStatus[] = ['no', 'baja', 'ok', 'fuga']
const STATUS_COLOR: Record<ReportStatus, string> = {
  no: 'var(--c-no)',
  baja: 'var(--c-baja)',
  ok: 'var(--c-ok)',
  fuga: 'var(--c-fuga)',
}

const fmtHora = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const fmtDia = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
// Fecha AAAA-MM-DD en hora de Guadalajara, para saber si fue hoy o ayer
const fmtClave = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "Hoy a las 11:16 a.m." · "Ayer a las 8:05 p.m." · "Sábado, 10 de octubre a las 9:30 a.m." */
export function formatFechaHora(iso: string): string {
  const fecha = new Date(iso)
  const clave = fmtClave.format(fecha)
  const hoy = fmtClave.format(new Date())
  const ayer = fmtClave.format(new Date(Date.now() - 86_400_000))
  const dia = clave === hoy ? 'Hoy' : clave === ayer ? 'Ayer' : capitalizar(fmtDia.format(fecha))
  return `${dia} a las ${fmtHora.format(fecha)}`
}

/** "7 días" para 168 h, "24 horas" para 24 h. */
function ventanaTexto(horas: number): string {
  if (horas >= 48 && horas % 24 === 0) return `${horas / 24} días`
  return `${horas} horas`
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Detalle armado con lo que ya tiene el mapa (`/resumen`), por si
 * `/api/colonias/{id}` falla: sin calidad ni hora del último reporte.
 */
function detalleDesdeResumen(colonia: Colonia, r?: ColoniaResumenProps): ColoniaDetalle {
  const status = { no: r?.sin_agua ?? 0, baja: r?.baja_presion ?? 0, ok: r?.con_agua ?? 0, fuga: r?.fugas ?? 0 }
  return {
    colonia_id: colonia.id,
    nombre: colonia.nombre,
    municipio: colonia.municipio,
    cp: colonia.cp || null,
    ventana_horas: Math.round(REPORT_EXPIRY_MS / 3_600_000),
    total: r?.total ?? 0,
    status,
    status_dominante: r?.total ? r.estado : null,
    quality: { mal_olor: 0, turbia: 0, sedimentos: 0, otro: 0 },
    quality_total: 0,
    ultimo_reporte: null,
    comentarios: [],
  }
}

interface ColoniaSheetOptions {
  // "Reportar en esta colonia"
  onReport: (colonia: Colonia, trigger: HTMLElement) => void
  // Se cerró con ✕ o Esc
  onClose: () => void
}

export function initColoniaSheet({ onReport, onClose }: ColoniaSheetOptions) {
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
  const sheet = $('#colonia-sheet')
  const el = {
    nombre: $('#cs-nombre'),
    sub: $('#cs-sub'),
    badge: $('#cs-badge'),
    ultimoRow: $('#cs-ultimo-row'),
    ultimo: $('#cs-ultimo'),
    supply: $('#cs-supply'),
    supplyLabel: $('#cs-supply-label'),
    bar: $('#cs-bar'),
    counts: $('#cs-counts'),
    quality: $('#cs-quality'),
    chips: $('#cs-chips'),
    empty: $('#cs-empty'),
    error: $('#cs-error'),
    comments: $('#cs-comments'),
    commentsList: $<HTMLUListElement>('#cs-comments-list'),
    report: $<HTMLButtonElement>('#cs-report'),
    close: $<HTMLButtonElement>('#cs-close'),
  }

  let colonia: Colonia | null = null
  let ctrl: AbortController | null = null

  function li(texto: string, numero: number, color?: string): HTMLLIElement {
    const item = document.createElement('li')
    if (color) {
      const dot = document.createElement('span')
      dot.className = 'cs-dot'
      dot.style.setProperty('--dot', color)
      dot.setAttribute('aria-hidden', 'true')
      item.append(dot)
    }
    const b = document.createElement('b')
    b.textContent = String(numero)
    item.append(`${texto} `, b)
    return item
  }

  function comentario(c: ColoniaComentario): HTMLLIElement {
    const item = document.createElement('li')
    item.className = 'cs-comment'

    const meta = document.createElement('p')
    meta.className = 'cs-comment-meta'
    const dot = document.createElement('span')
    dot.className = 'cs-dot'
    dot.style.setProperty('--dot', STATUS_COLOR[c.status])
    dot.setAttribute('aria-hidden', 'true')
    const fecha = document.createElement('time')
    fecha.dateTime = c.created_at
    fecha.textContent = formatFechaHora(c.created_at)
    meta.append(dot, `${STATUS_LABELS[c.status]} · `, fecha)
    item.append(meta)

    if (c.quality_other) {
      const otro = document.createElement('p')
      otro.className = 'cs-comment-other'
      otro.textContent = `Otro: ${c.quality_other}`
      item.append(otro)
    }
    if (c.comment) {
      const texto = document.createElement('p')
      texto.className = 'cs-comment-text'
      texto.textContent = c.comment
      item.append(texto)
    }
    return item
  }

  // DOM con textContent: nunca se arma HTML con datos
  function render(d: ColoniaDetalle): void {
    el.nombre.textContent = d.nombre || 'Colonia sin nombre'
    el.sub.textContent = [d.municipio, d.cp && `CP ${d.cp}`].filter(Boolean).join(' · ')

    // Estado dominante
    el.badge.hidden = d.total === 0
    if (d.status_dominante) {
      el.badge.dataset.status = d.status_dominante
      el.badge.textContent = `Mayoría ${STATUS_LABELS[d.status_dominante].toLowerCase()}`
    } else {
      delete el.badge.dataset.status
      el.badge.textContent = 'Reportes mixtos'
    }

    // Último reporte
    el.ultimoRow.hidden = !d.ultimo_reporte
    el.ultimo.textContent = d.ultimo_reporte ? `Último reporte: ${formatFechaHora(d.ultimo_reporte)}` : ''

    // Suministro
    el.supply.hidden = d.total === 0
    el.supplyLabel.textContent =
      `Suministro · ${d.total} ${d.total === 1 ? 'reporte' : 'reportes'} en los últimos ${ventanaTexto(d.ventana_horas)}`
    el.bar.replaceChildren()
    el.counts.replaceChildren()
    for (const s of STATUS_ORDER) {
      const n = d.status[s]
      if (n > 0) {
        const seg = document.createElement('span')
        seg.style.flex = String(n)
        seg.style.setProperty('--seg', STATUS_COLOR[s])
        el.bar.append(seg)
      }
      el.counts.append(li(STATUS_LABELS[s], n, STATUS_COLOR[s]))
    }
    el.bar.setAttribute('aria-label', STATUS_ORDER.map((s) => `${STATUS_LABELS[s]}: ${d.status[s]}`).join(', '))

    // Calidad: solo las que tienen reportes, de mayor a menor
    const conReportes = QUALITY_ORDER.filter((q) => d.quality[q] > 0).sort((a, b) => d.quality[b] - d.quality[a])
    el.quality.hidden = conReportes.length === 0
    el.chips.replaceChildren(...conReportes.map((q) => li(QUALITY_LABELS[q], d.quality[q])))

    // Comentarios: historial de la colonia, aunque ya no haya reportes activos
    const comentarios = d.comentarios ?? []
    el.comments.hidden = comentarios.length === 0
    el.commentsList.replaceChildren(...comentarios.map(comentario))

    el.empty.hidden = d.total > 0
    el.empty.textContent =
      `Nadie ha reportado aquí en los últimos ${ventanaTexto(d.ventana_horas)}. ¿Cómo está el agua en tu casa?`
  }

  /** Abre (o actualiza) la hoja. `resumen` se muestra al instante y sirve de respaldo si la API falla. */
  async function open(c: Colonia, resumen?: ColoniaResumenProps): Promise<void> {
    const reopen = colonia?.id === c.id && !sheet.hidden
    colonia = c
    el.error.textContent = ''
    if (!reopen) render(detalleDesdeResumen(c, resumen))
    sheet.hidden = false
    document.body.classList.add('colonia-open')
    if (!reopen) el.nombre.focus()

    ctrl?.abort()
    ctrl = new AbortController()
    sheet.setAttribute('aria-busy', 'true')
    try {
      const detalle = await getColoniaDetalle(c.id, ctrl.signal)
      if (colonia?.id === c.id) render(detalle)
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
      console.error(err)
      // Se queda lo del resumen; solo falta la calidad y la hora
      if (colonia?.id === c.id) render(detalleDesdeResumen(c, resumen))
    } finally {
      sheet.removeAttribute('aria-busy')
    }
  }

  function close(): void {
    ctrl?.abort()
    colonia = null
    sheet.hidden = true
    document.body.classList.remove('colonia-open')
  }

  el.close.addEventListener('click', () => {
    close()
    onClose()
  })
  el.report.addEventListener('click', () => {
    if (colonia) onReport(colonia, el.report)
  })
  document.addEventListener('keydown', (e) => {
    // Si la hoja de reporte estaba abierta, ella atendió el Esc (preventDefault)
    if (e.key !== 'Escape' || sheet.hidden || e.defaultPrevented) return
    close()
    onClose()
  })

  return {
    open,
    close,
    get current() {
      return colonia
    },
    setReportEnabled(enabled: boolean) {
      el.report.disabled = !enabled
    },
  }
}
