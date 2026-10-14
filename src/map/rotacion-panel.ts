import { fetchRotacion } from './api'
import { DIAS, DIAS_CORTOS, ZONA_COLORS, listaDias } from './config'
import type { Rotacion } from './types'

// Panel "Racionamiento programado": botón con calendario junto a la lupa.
// Muestra qué zonas tienen racionamiento hoy, el calendario semanal y la fuente
// (SIAPA). Los datos se piden la primera vez que se abre.

const fmtFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' })

interface RotacionPanelOptions {
  // Prender/apagar las zonas en el mapa
  onMapaChange: (visible: boolean) => void
  // Ya llegaron los datos: qué zonas tienen racionamiento hoy
  onData: (data: Rotacion) => void
  // Se abrió el panel (para cerrar el buscador)
  onOpen: () => void
}

export function initRotacionPanel({ onMapaChange, onData, onOpen }: RotacionPanelOptions) {
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
  const root = $('#map-rotacion')
  const toggle = $<HTMLButtonElement>('#rotacion-toggle')
  const panel = $('#rotacion-panel')
  const title = $('#rotacion-title')
  const closeBtn = $<HTMLButtonElement>('#rotacion-close')
  const hoyEl = $('#rotacion-hoy')
  const nota = $('#rotacion-nota')
  const tabla = $<HTMLTableElement>('#rotacion-tabla')
  const mapa = $<HTMLInputElement>('#rotacion-mapa')
  const whatsapp = $<HTMLAnchorElement>('#rotacion-whatsapp')
  const telefono = $<HTMLAnchorElement>('#rotacion-telefono')
  const fuente = $('#rotacion-fuente')
  const msg = $('#rotacion-msg')

  let data: Rotacion | null = null
  let cargando: Promise<void> | null = null

  // ─── Datos ───

  function load(): Promise<void> {
    cargando ??= fetchRotacion()
      .then((d) => {
        data = d
        render(d)
        onData(d)
      })
      .catch((err) => {
        console.error(err)
        cargando = null // se reintenta al volver a abrir
        msg.textContent = 'No se pudo cargar el calendario. Intenta de nuevo.'
      })
    return cargando
  }

  // DOM con textContent: nunca se arma HTML con datos
  function render(d: Rotacion): void {
    msg.textContent = ''
    const hoy = d.zonas.filter((z) => z.hoy).map((z) => z.nombre)
    const dia = DIAS[d.hoy - 1]
    hoyEl.replaceChildren()
    const b = document.createElement('b')
    b.textContent = `Hoy ${dia}:`
    hoyEl.append(
      b,
      hoy.length
        ? ` baja presión en ${hoy.length > 1 ? `${hoy.slice(0, -1).join(', ')} y ${hoy.at(-1)}` : hoy[0]}.`
        : ' ninguna zona tiene racionamiento.',
    )
    nota.textContent = d.nota

    // Calendario: una fila por zona, una columna por día; hoy resaltado
    const thead = document.createElement('thead')
    const head = document.createElement('tr')
    const corner = document.createElement('th')
    corner.scope = 'col'
    corner.textContent = 'Zona'
    head.append(corner)
    DIAS_CORTOS.forEach((corto, i) => {
      const th = document.createElement('th')
      th.scope = 'col'
      th.textContent = corto
      th.title = DIAS[i]
      th.setAttribute('aria-label', DIAS[i])
      if (i + 1 === d.hoy) th.className = 'is-hoy'
      head.append(th)
    })
    thead.append(head)

    const tbody = document.createElement('tbody')
    for (const z of d.zonas) {
      const tr = document.createElement('tr')
      tr.style.setProperty('--zona', ZONA_COLORS[z.zona] ?? '#5f6b73')
      const th = document.createElement('th')
      th.scope = 'row'
      const swatch = document.createElement('span')
      swatch.className = 'rotacion-swatch'
      swatch.setAttribute('aria-hidden', 'true')
      th.append(swatch, z.nombre)
      th.title = `${z.nombre}: ${listaDias(z.dias)}${z.colonias ? ` · ${z.colonias} colonias` : ''}`
      tr.append(th)
      for (let dia = 1; dia <= 7; dia++) {
        const td = document.createElement('td')
        const toca = z.dias.includes(dia)
        td.className = [toca ? 'is-corte' : '', dia === d.hoy ? 'is-hoy' : ''].filter(Boolean).join(' ')
        td.setAttribute('aria-label', toca ? `${DIAS[dia - 1]}: racionamiento` : `${DIAS[dia - 1]}: normal`)
        if (toca) {
          const dot = document.createElement('span')
          dot.className = 'rotacion-dot'
          dot.setAttribute('aria-hidden', 'true')
          td.append(dot)
        }
        tr.append(td)
      }
      tbody.append(tr)
    }
    tabla.querySelector('thead')?.remove()
    tabla.querySelector('tbody')?.remove()
    tabla.append(thead, tbody)

    whatsapp.href = `https://wa.me/${d.contacto.whatsapp}`
    telefono.href = `tel:${d.contacto.telefono}`
    telefono.textContent = `SIAPATEL ${d.contacto.telefono}`

    fuente.replaceChildren()
    const a = document.createElement('a')
    a.href = d.fuente_url
    a.target = '_blank'
    a.rel = 'noopener'
    a.textContent = 'SIAPA'
    // "2026-10-13" en UTC para que no se corra un día por la zona horaria
    const fecha = fmtFecha.format(new Date(`${d.actualizado}T00:00:00Z`))
    fuente.append('Fuente: ', a, ` · calendario del ${fecha}. Zonas aproximadas según el mapa oficial.`)
  }

  // ─── Abrir y cerrar ───

  function open(): void {
    onOpen()
    panel.hidden = false
    root.classList.add('is-open')
    document.body.classList.add('rotacion-open')
    toggle.setAttribute('aria-expanded', 'true')
    title.focus()
    void load()
  }

  function close(returnFocus = true): void {
    if (panel.hidden) return
    panel.hidden = true
    root.classList.remove('is-open')
    document.body.classList.remove('rotacion-open')
    toggle.setAttribute('aria-expanded', 'false')
    if (returnFocus) toggle.focus()
  }

  toggle.addEventListener('click', () => (panel.hidden ? open() : close()))
  closeBtn.addEventListener('click', () => close())
  mapa.addEventListener('change', () => {
    onMapaChange(mapa.checked)
    if (mapa.checked) void load() // las zonas de hoy necesitan el calendario
  })

  // Esc cierra el panel; preventDefault para que la hoja de colonia no se cierre también
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return
    e.preventDefault()
    close()
  })

  return {
    open,
    close,
    load,
    /** Sincroniza el interruptor cuando la capa se prende desde el botón de capas. */
    setMapa(visible: boolean) {
      mapa.checked = visible
    },
    get data() {
      return data
    },
  }
}
