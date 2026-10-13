import { REPORT_EXPIRY_MS, STATUS_LABELS } from './config'
import type { ReportStatus, ResumenCollection } from './types'

// Resumen para el ciudadano en el panel de abajo: cuántos reportes llevamos.
// Los números vigentes salen del mismo resumen que dibuja el mapa, así se
// actualizan en vivo con cada reporte. Por ahora no cuenta las fugas.

const TZ = 'America/Mexico_City'
const STATUS_ORDER: ReportStatus[] = ['no', 'baja', 'ok']
const STATUS_COLOR: Partial<Record<ReportStatus, string>> = {
  no: 'var(--c-no)',
  baja: 'var(--c-baja)',
  ok: 'var(--c-ok)',
}

const fmtNum = new Intl.NumberFormat('es-MX')
const fmtHora = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const horas = Math.round(REPORT_EXPIRY_MS / 3_600_000)

function plural(n: number, uno: string, varios: string): string {
  return `${fmtNum.format(n)} ${n === 1 ? uno : varios}`
}

export function initStatsPanel() {
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
  const root = $('#stats')
  const toggle = $<HTMLButtonElement>('#stats-toggle')
  const summary = $('#stats-summary')
  const detail = $('#stats-detail')
  const bar = $('#stats-bar')
  const counts = $<HTMLUListElement>('#stats-counts')
  const colonias = $('#stats-colonias')
  const sinAgua = $('#stats-sin-agua')
  const historico = $('#stats-historico')
  const updated = $('#stats-updated')

  toggle.addEventListener('click', () => {
    const open = detail.hidden
    detail.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
  })

  // DOM con textContent: nunca se arma HTML con datos
  function update(data: ResumenCollection): void {
    const total = { no: 0, baja: 0, ok: 0 }
    let conReportes = 0
    let mayoriaSinAgua = 0
    for (const { properties: p } of data.features) {
      const suministro = p.sin_agua + p.baja_presion + p.con_agua
      if (suministro === 0) continue // solo fugas: fuera del resumen por ahora
      total.no += p.sin_agua
      total.baja += p.baja_presion
      total.ok += p.con_agua
      conReportes++
      if (p.sin_agua > p.baja_presion && p.sin_agua > p.con_agua) mayoriaSinAgua++
    }
    const suma = total.no + total.baja + total.ok

    root.hidden = false
    summary.textContent = suma
      ? `${plural(suma, 'reporte', 'reportes')} en las últimas ${horas} h · ${plural(conReportes, 'colonia', 'colonias')}`
      : `Sin reportes en las últimas ${horas} h. ¡Sé el primero!`
    toggle.disabled = suma === 0
    if (!suma) {
      detail.hidden = true
      toggle.setAttribute('aria-expanded', 'false')
    }

    bar.replaceChildren()
    counts.replaceChildren()
    for (const s of STATUS_ORDER) {
      const n = total[s as keyof typeof total]
      if (n > 0) {
        const seg = document.createElement('span')
        seg.style.flex = String(n)
        seg.style.setProperty('--seg', STATUS_COLOR[s]!)
        bar.append(seg)
      }
      const li = document.createElement('li')
      const dot = document.createElement('span')
      dot.className = 'cs-dot'
      dot.style.setProperty('--dot', STATUS_COLOR[s]!)
      dot.setAttribute('aria-hidden', 'true')
      const b = document.createElement('b')
      b.textContent = fmtNum.format(n)
      const pct = document.createElement('span')
      pct.className = 'stats-pct'
      pct.textContent = suma ? `${Math.round((n / suma) * 100)}%` : ''
      li.append(dot, `${STATUS_LABELS[s]} `, b, ' ', pct)
      counts.append(li)
    }
    bar.setAttribute('aria-label', STATUS_ORDER.map((s) => `${STATUS_LABELS[s]}: ${total[s as keyof typeof total]}`).join(', '))

    colonias.textContent = fmtNum.format(conReportes)
    sinAgua.textContent = fmtNum.format(mayoriaSinAgua)
    updated.textContent = `Actualizado a las ${fmtHora.format(new Date())}`
  }

  function setHistorico(n: number): void {
    historico.textContent = fmtNum.format(n)
  }

  return { update, setHistorico }
}
