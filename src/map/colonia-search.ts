import { searchColonias } from './api'
import type { ColoniaBusqueda } from './types'

// Buscador de colonias: un botón con la lupa que despliega la barra de búsqueda.
// Los resultados siguen el patrón combobox (flechas, Enter, Esc).

const MIN_CHARS = 2
const DEBOUNCE_MS = 200

interface ColoniaSearchOptions {
  // Centro del mapa visible, para que entre homónimos salga primero la más cercana
  getCenter: () => [number, number]
  onSelect: (colonia: ColoniaBusqueda) => void
}

export function initColoniaSearch({ getCenter, onSelect }: ColoniaSearchOptions) {
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
  const root = $('#map-search')
  const toggle = $<HTMLButtonElement>('#search-toggle')
  const box = $('#search-box')
  const input = $<HTMLInputElement>('#search-input')
  const closeBtn = $<HTMLButtonElement>('#search-close')
  const list = $<HTMLUListElement>('#search-results')
  const msg = $('#search-msg')

  let results: ColoniaBusqueda[] = []
  let active = -1
  let timer: number | undefined
  let ctrl: AbortController | null = null

  // ─── Abrir y cerrar ───

  function open(): void {
    root.classList.add('is-open')
    document.body.classList.add('search-open')
    box.hidden = false
    toggle.setAttribute('aria-expanded', 'true')
    toggle.setAttribute('aria-label', 'Cerrar búsqueda')
    input.focus()
    input.select()
  }

  function close(returnFocus = true): void {
    root.classList.remove('is-open')
    document.body.classList.remove('search-open')
    box.hidden = true
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', 'Buscar colonia')
    window.clearTimeout(timer)
    ctrl?.abort()
    input.value = ''
    showResults([])
    setMsg('')
    if (returnFocus) toggle.focus()
  }

  // ─── Resultados ───

  function setMsg(text: string): void {
    msg.textContent = text
    msg.hidden = !text
  }

  function setActive(i: number): void {
    active = i
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((el, j) => {
      el.setAttribute('aria-selected', String(j === i))
      if (j === i) el.scrollIntoView({ block: 'nearest' })
    })
    if (i >= 0) input.setAttribute('aria-activedescendant', `search-opt-${i}`)
    else input.removeAttribute('aria-activedescendant')
  }

  // DOM con textContent: nunca se arma HTML con datos
  function showResults(items: ColoniaBusqueda[]): void {
    results = items
    list.replaceChildren(
      ...items.map((c, i) => {
        const li = document.createElement('li')
        li.id = `search-opt-${i}`
        li.className = 'search-option'
        li.setAttribute('role', 'option')
        li.setAttribute('aria-selected', 'false')
        const nombre = document.createElement('span')
        nombre.className = 'search-option-name'
        nombre.textContent = c.nombre
        const sub = document.createElement('span')
        sub.className = 'search-option-sub'
        sub.textContent = [c.municipio, c.cp && `CP ${c.cp}`].filter(Boolean).join(' · ')
        li.append(nombre, sub)
        return li
      }),
    )
    list.hidden = items.length === 0
    input.setAttribute('aria-expanded', String(items.length > 0))
    setActive(items.length ? 0 : -1)
  }

  function choose(i: number): void {
    const colonia = results[i]
    if (!colonia) return
    close(false)
    onSelect(colonia)
  }

  async function search(q: string): Promise<void> {
    ctrl?.abort()
    ctrl = new AbortController()
    try {
      const items = await searchColonias(q, getCenter(), ctrl.signal)
      showResults(items)
      setMsg(items.length ? '' : `No encontramos colonias con “${q}”.`)
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return
      console.error(err)
      showResults([])
      setMsg('No se pudo buscar. Revisa tu conexión e intenta de nuevo.')
    }
  }

  // ─── Eventos ───

  toggle.addEventListener('click', () => (box.hidden ? open() : close()))
  closeBtn.addEventListener('click', () => close())

  input.addEventListener('input', () => {
    window.clearTimeout(timer)
    const q = input.value.trim()
    if (q.length < MIN_CHARS) {
      ctrl?.abort()
      showResults([])
      setMsg('')
      return
    }
    timer = window.setTimeout(() => void search(q), DEBOUNCE_MS)
  })

  // Al volver al campo, se recuperan los resultados que se ocultaron al tocar fuera
  input.addEventListener('focus', () => {
    const q = input.value.trim()
    if (q.length >= MIN_CHARS && !results.length) void search(q)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      setActive((active + 1) % results.length)
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      setActive((active - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    }
  })

  // pointerdown + preventDefault: el input no pierde el foco antes del click
  list.addEventListener('pointerdown', (e) => e.preventDefault())
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]')
    if (li) choose(Number(li.id.replace('search-opt-', '')))
  })

  // Esc cierra el buscador; preventDefault para que la hoja de colonia no se cierre también
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || box.hidden) return
    e.preventDefault()
    close()
  })

  // Tocar fuera (el mapa, la hoja) cierra el buscador si no se escribió nada
  document.addEventListener('pointerdown', (e) => {
    if (box.hidden || root.contains(e.target as Node)) return
    if (!input.value.trim()) close(false)
    else showResults([])
  })

  return { open, close }
}
