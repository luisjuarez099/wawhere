import type { IControl } from 'maplibre-gl'

interface Option {
  id: string
  label: string
}

interface OverlayOptions {
  label: string
  initial: boolean
  onChange: (on: boolean) => void
}

// Icono de capas apiladas, del mismo tamaño y trazo que los íconos de MapLibre
const LAYERS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="#333" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 2.5 8 12 13l9.5-5L12 3Z"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="m2.5 16 9.5 5 9.5-5"/></svg>`

/**
 * Botón de capas con el estilo de los controles de MapLibre (`maplibregl-ctrl-group`).
 * Abre un panel para elegir el mapa base y prender/apagar capas.
 */
export class LayerControls implements IControl {
  private container = document.createElement('div')
  private panel = document.createElement('div')
  private button = document.createElement('button')
  private basemapList = document.createElement('fieldset')
  private overlayList = document.createElement('fieldset')

  constructor() {
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group layer-control'

    this.button.type = 'button'
    this.button.className = 'layer-control-button'
    this.button.title = 'Capas del mapa'
    this.button.setAttribute('aria-label', 'Capas del mapa')
    this.button.setAttribute('aria-expanded', 'false')
    this.button.setAttribute('aria-controls', 'layer-panel')
    this.button.innerHTML = LAYERS_ICON
    this.button.addEventListener('click', () => this.setOpen(this.panel.hidden))

    this.panel.id = 'layer-panel'
    this.panel.className = 'layer-panel'
    this.panel.hidden = true
    this.basemapList.innerHTML = '<legend>Mapa base</legend>'
    this.overlayList.innerHTML = '<legend>Capas</legend>'
    this.overlayList.hidden = true
    this.panel.append(this.basemapList, this.overlayList)

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

  basemaps(options: Option[], initial: string, onChange: (id: string) => void): this {
    for (const opt of options) {
      const input = this.row(this.basemapList, 'radio', opt.label)
      input.name = 'basemap'
      input.checked = opt.id === initial
      input.addEventListener('change', () => input.checked && onChange(opt.id))
    }
    return this
  }

  overlay({ label, initial, onChange }: OverlayOptions): this {
    this.overlayList.hidden = false
    const input = this.row(this.overlayList, 'checkbox', label)
    input.checked = initial
    input.addEventListener('change', () => onChange(input.checked))
    return this
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

  private row(list: HTMLElement, type: 'radio' | 'checkbox', text: string): HTMLInputElement {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = type
    label.append(input, ' ', text)
    list.append(label)
    return input
  }
}
