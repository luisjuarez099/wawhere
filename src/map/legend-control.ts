import type { IControl } from 'maplibre-gl'
import { STATUS_COLORS, STATUS_LABELS } from './config'
import { donutSVG } from './donut'
import type { ReportStatus } from './types'

// Mismo orden que el anillo de las donas: lo más grave primero. Sin fugas por ahora.
const ORDER: ReportStatus[] = ['no', 'baja', 'ok']

// Lista con puntos, del mismo tamaño y trazo que los íconos de MapLibre
const LEGEND_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="#333" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="7" r="1.5" fill="#333"/><circle cx="5" cy="12" r="1.5" fill="#333"/><circle cx="5" cy="17" r="1.5" fill="#333"/><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/></svg>`

/**
 * Botón de leyenda con el estilo de los controles de MapLibre, debajo del de
 * ubicación. Abre un panel a la izquierda, como el botón de capas.
 */
export class LegendControl implements IControl {
  private container = document.createElement('div')
  private button = document.createElement('button')
  private panel = document.createElement('div')

  constructor() {
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group layer-control'

    this.button.type = 'button'
    this.button.className = 'layer-control-button'
    this.button.title = 'Leyenda'
    this.button.setAttribute('aria-label', 'Leyenda del mapa')
    this.button.setAttribute('aria-expanded', 'false')
    this.button.setAttribute('aria-controls', 'legend-panel')
    this.button.innerHTML = LEGEND_ICON
    this.button.addEventListener('click', () => this.setOpen(this.panel.hidden))

    this.panel.id = 'legend-panel'
    this.panel.className = 'layer-panel map-legend-panel'
    this.panel.hidden = true

    const title = document.createElement('p')
    title.className = 'map-legend-title'
    // El anillo muestra todos los estados; el relleno de la colonia, el más reportado
    title.textContent = 'Estado del agua'

    const list = document.createElement('ul')
    list.className = 'map-legend-list'
    for (const status of ORDER) {
      const li = document.createElement('li')
      const dot = document.createElement('span')
      dot.className = 'map-legend-dot'
      dot.style.setProperty('--dot', STATUS_COLORS[status])
      dot.setAttribute('aria-hidden', 'true')
      li.append(dot, STATUS_LABELS[status])
      list.append(li)
    }

    // Dona de ejemplo: 3 sin agua y 2 con agua
    const ejemplo = document.createElement('div')
    ejemplo.className = 'map-legend-example'
    const texto = document.createElement('p')
    texto.className = 'map-legend-hint'
    texto.textContent = 'El número es el total de reportes; el anillo, la parte de cada estado (aproximada).'
    ejemplo.append(donutSVG({ total: 5, sin_agua: 3, fugas: 0, baja_presion: 0, con_agua: 2 }), texto)

    this.panel.append(title, list, ejemplo)
    this.container.append(this.button, this.panel)

    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) this.setOpen(false)
    })
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.setOpen(false)
        this.button.focus()
      }
    })
  }

  onAdd(): HTMLElement {
    return this.container
  }

  onRemove(): void {
    this.container.remove()
  }

  private setOpen(open: boolean): void {
    this.panel.hidden = !open
    this.button.setAttribute('aria-expanded', String(open))
  }
}
