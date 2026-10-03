import type { IControl } from 'maplibre-gl'

interface ToggleOptions {
  icon: string
  label: string
  initial: boolean
  onChange: (on: boolean) => void
}

interface ActionOptions {
  icon: string
  label: string
  onClick: (button: HTMLButtonElement) => void
}

/**
 * Botones 🔥 📌 📍 con el mismo estilo que los controles de zoom de MapLibre
 * (`maplibregl-ctrl-group`), así se ven como parte del mapa.
 */
export class LayerControls implements IControl {
  private container = document.createElement('div')

  constructor() {
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group map-controls'
  }

  toggle({ icon, label, initial, onChange }: ToggleOptions): this {
    const btn = this.button(icon, label)
    btn.setAttribute('aria-pressed', String(initial))
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true'
      btn.setAttribute('aria-pressed', String(on))
      onChange(on)
    })
    return this
  }

  action({ icon, label, onClick }: ActionOptions): this {
    const btn = this.button(icon, label)
    btn.addEventListener('click', () => onClick(btn))
    return this
  }

  onAdd(): HTMLElement {
    return this.container
  }

  onRemove(): void {
    this.container.remove()
  }

  private button(icon: string, label: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = label
    btn.setAttribute('aria-label', label)
    btn.textContent = icon
    this.container.append(btn)
    return btn
  }
}
