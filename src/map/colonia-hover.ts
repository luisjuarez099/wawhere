import type { MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl'
import { COLONIA_HIT_LAYER } from './boundaries-layer'
import { ZONA_COLORS } from './config'
import type { Rotacion } from './types'

// Aviso al pasar el mouse por una colonia: nombre, CP y si está en el esquema rotatorio
// del SIAPA. Solo con mouse; en el teléfono se toca la colonia y se abre su hoja.

interface ColoniaHoverOptions {
  // Calendario del SIAPA, para decir si hoy le toca; puede no haber cargado todavía
  getRotacion: () => Rotacion | null
}

export function initColoniaHover(map: MapLibreMap, { getRotacion }: ColoniaHoverOptions): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

  const tip = document.createElement('div')
  tip.className = 'colonia-tip'
  tip.hidden = true
  tip.setAttribute('role', 'tooltip')
  map.getContainer().appendChild(tip)

  let actual: number | null = null

  function ocultar(): void {
    tip.hidden = true
    actual = null
    map.getCanvas().style.cursor = ''
  }

  // DOM con textContent: nunca se arma HTML con datos
  function llenar(p: Record<string, unknown>): void {
    const nombre = document.createElement('strong')
    nombre.className = 'colonia-tip-nombre'
    nombre.textContent = String(p.nombre || 'Colonia sin nombre')

    const sub = document.createElement('span')
    sub.className = 'colonia-tip-sub'
    sub.textContent = [p.cp && `CP ${p.cp}`, p.municipio].filter(Boolean).join(' · ')

    const zonas = String(p.zonas ?? '').split(',').map(Number).filter((z) => z > 0)
    const estado = document.createElement('p')
    estado.className = zonas.length ? 'colonia-tip-estado is-dentro' : 'colonia-tip-estado'
    estado.textContent = zonas.length
      ? 'Dentro de las zonas de racionamiento'
      : 'Fuera de las zonas de racionamiento'

    const hijos: HTMLElement[] = [nombre, sub, estado]
    if (zonas.length) {
      const hoy = new Set(getRotacion()?.zonas.filter((z) => z.hoy).map((z) => z.zona))
      const lista = document.createElement('ul')
      lista.className = 'colonia-tip-zonas'
      for (const z of zonas) {
        const li = document.createElement('li')
        const swatch = document.createElement('span')
        swatch.className = 'rotacion-swatch'
        swatch.setAttribute('aria-hidden', 'true')
        li.style.setProperty('--zona', ZONA_COLORS[z] ?? '#5f6b73')
        li.append(swatch, `Zona ${z}`)
        if (hoy.has(z)) {
          const tag = document.createElement('b')
          tag.textContent = ' · hoy le toca'
          li.append(tag)
        }
        lista.append(li)
      }
      hijos.push(lista)
    }
    tip.replaceChildren(...hijos)
  }

  function mover(e: MapLayerMouseEvent): void {
    // Arrastrando el mapa no estorba
    if (e.originalEvent.buttons) return ocultar()
    const feature = e.features?.[0]
    if (!feature || feature.id == null) return ocultar()

    const id = Number(feature.id)
    if (id !== actual) {
      actual = id
      llenar(feature.properties ?? {})
      map.getCanvas().style.cursor = 'pointer'
      tip.hidden = false
    }

    // Junto al cursor, del lado donde quepa
    const { x, y } = e.point
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    const left = x + 16 + tip.offsetWidth > w ? x - 16 - tip.offsetWidth : x + 16
    const top = y + 16 + tip.offsetHeight > h ? y - 16 - tip.offsetHeight : y + 16
    tip.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, top)}px)`
  }

  map.on('mousemove', COLONIA_HIT_LAYER, mover)
  map.on('mouseleave', COLONIA_HIT_LAYER, ocultar)
  map.on('movestart', ocultar)
  map.getContainer().addEventListener('mouseleave', ocultar)
}
