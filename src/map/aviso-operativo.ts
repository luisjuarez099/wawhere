// Aviso del operativo de agua de Zapopan: configuración, reglas, modal y bloque de la hoja.
// Las reglas son funciones puras; el DOM se arma con createElement y textContent.
import './aviso-operativo.css'


export interface AvisoOperativo {
  id: string // si cambia, el modal vuelve a salir
  activo: boolean
  vigenteHasta?: string // último día que se muestra, AAAA-MM-DD (hora de Guadalajara)
  municipios: string[]
  zonas: number[] // zonas del SIAPA activas
  porcentajeMinimo: number // porcentaje mínimo de la colonia dentro de la zona
  coloniasExtra: number[] // aplican aunque el polígono no las toque
  coloniasExcluidas: number[] // nunca lo muestran
  telefono: { visible: string; marcar: string }
}

export const AVISO: AvisoOperativo = {
  id: 'zapopan-operativo-suministro-2026-10',
  activo: true,
  municipios: ['Zapopan'],
  zonas: [6],
  porcentajeMinimo: 0,
  coloniasExtra: [],
  coloniasExcluidas: [],
  telefono: { visible: '33 2410 1000', marcar: '+523324101000' },
}

export interface ZonaColonia {
  zona: number
  porcentaje?: number // undefined cuando la fuente no lo trae (vector tile)
}

// Misma zona horaria que colonia-sheet.ts y stats-panel.ts
const TZ = 'America/Mexico_City'
const fmtClave = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Fecha de hoy en Guadalajara, AAAA-MM-DD. */
export function hoyGuadalajara(ahora: Date = new Date()): string {
  return fmtClave.format(ahora)
}

/** Sin acentos, sin mayúsculas ni espacios de más. */
export function normalizarMunicipio(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/**
 * Lee el campo `zonas` sin importar su forma: "6", "2,6", "[6]",
 * JSON con porcentajes o arreglo de objetos. Descarta lo que no sea zona válida.
 */
export function parseZonas(valor: unknown): ZonaColonia[] {
  let v: unknown = valor
  if (typeof v === 'string') {
    const texto = v.trim()
    if (!texto) return []
    try {
      v = JSON.parse(texto)
    } catch {
      v = texto.split(',')
    }
  }
  const items = Array.isArray(v) ? v : [v]

  const porZona = new Map<number, ZonaColonia>()
  for (const item of items) {
    const crudo = typeof item === 'object' && item !== null ? (item as { zona?: unknown }).zona : item
    const zona = Number(crudo)
    if (!Number.isInteger(zona) || zona <= 0) continue
    const porcentajeCrudo = typeof item === 'object' && item !== null ? (item as { porcentaje?: unknown }).porcentaje : undefined
    const porcentaje = porcentajeCrudo === undefined ? undefined : Number(porcentajeCrudo)
    // Si una zona viene repetida, se queda con el mayor porcentaje
    const previo = porZona.get(zona)
    if (!previo || (porcentaje ?? 0) > (previo.porcentaje ?? 0)) {
      porZona.set(zona, { zona, porcentaje: Number.isFinite(porcentaje) ? porcentaje : undefined })
    }
  }
  return [...porZona.values()]
}

export interface ColoniaAviso {
  id: number
  municipio: string
}

/**
 * ¿Mostrar el aviso para esta colonia?
 * Orden: activo, vigencia, exclusiones, extras, y después municipio y zona.
 */
export function aplicaAviso(
  colonia: ColoniaAviso,
  zonas: ZonaColonia[],
  aviso: AvisoOperativo = AVISO,
  hoy: string = hoyGuadalajara(),
): boolean {
  if (!aviso.activo) return false
  if (aviso.vigenteHasta && hoy > aviso.vigenteHasta) return false
  if (aviso.coloniasExcluidas.includes(colonia.id)) return false
  if (aviso.coloniasExtra.includes(colonia.id)) return true

  const municipios = aviso.municipios.map(normalizarMunicipio)
  if (!municipios.includes(normalizarMunicipio(colonia.municipio))) return false

  return zonas.some(
    (z) =>
      aviso.zonas.includes(z.zona) &&
      // Sin porcentaje no hay con qué comparar: cuenta como cumplido
      (z.porcentaje === undefined || z.porcentaje >= aviso.porcentajeMinimo),
  )
}

// ─── Modal (una vez por visita) ───

// Guardado en memoria: una recarga lo vuelve a mostrar. Si cambia AVISO.id, sale otra vez.
let idMostrado: string | null = null
let modal: HTMLDialogElement | null = null
let opener: HTMLElement | null = null

function crearElemento<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

const TITULO = 'Zapopan lleva agua gratis a tu colonia'
const FUENTE = 'Información oficial del Gobierno de Zapopan'
const REDES_URL = 'https://www.facebook.com/share/p/19GvdfQb9z/'

function enlaceLlamar(): HTMLAnchorElement {
  const enlace = crearElemento('a', 'aviso-llamar', `Llamar a la Línea 24/7 · ${AVISO.telefono.visible}`)
  enlace.href = `tel:${AVISO.telefono.marcar}`
  return enlace
}

function enlaceRedes(): HTMLParagraphElement {
  const p = crearElemento('p', 'aviso-nota')
  const enlace = crearElemento('a', undefined, 'nuestra publicación de Facebook')
  enlace.href = REDES_URL
  enlace.target = '_blank'
  enlace.rel = 'noopener noreferrer'
  p.append('Mira lo que estamos haciendo en ', enlace, '.')
  return p
}

function dato(numero: string, resto: string): HTMLLIElement {
  const item = crearElemento('li')
  item.append(crearElemento('b', undefined, numero), resto)
  return item
}

function crearModal(): HTMLDialogElement {
  const dialog = crearElemento('dialog', 'aviso-modal')
  dialog.setAttribute('aria-labelledby', 'aviso-modal-titulo')

  const titulo = crearElemento('h2', 'aviso-titulo', TITULO)
  titulo.id = 'aviso-modal-titulo'

  const datos = crearElemento('ul', 'aviso-datos')
  datos.append(
    dato('45', ' pipas en tres turnos, las 24 horas'),
    dato('100', ' cisternas comunitarias de 10 mil litros'),
  )

  const seguir = crearElemento('button', 'btn-secondary aviso-seguir', 'Seguir en el mapa')
  seguir.type = 'button'

  const cuerpo = crearElemento('div', 'aviso-modal-cuerpo')
  cuerpo.append(
    crearElemento('p', 'aviso-fuente', FUENTE),
    titulo,
    crearElemento(
      'p',
      'aviso-texto',
      'Tu colonia forma parte de la rotación del servicio del SIAPA. Si falta agua, haz el reporte por teléfono.',
    ),
    datos,
    enlaceLlamar(),
    crearElemento('p', 'aviso-nota', 'El reporte en AguaJalisco ayuda a los vecinos, pero no sustituye la solicitud de pipa.'),
    enlaceRedes(),
    seguir,
  )
  dialog.append(cuerpo)

  seguir.addEventListener('click', () => dialog.close())
  // Clic en el fondo: el diálogo ocupa la pantalla, así que el clic cae sobre él mismo
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    // Solo cierra el modal: la hoja de colonia que está debajo se queda abierta
    e.preventDefault()
    dialog.close()
  })
  // Al cerrar, el foco vuelve a quien abrió el modal
  dialog.addEventListener('close', () => opener?.focus())

  document.body.append(dialog)
  return dialog
}

function abrirModal(): void {
  modal ??= crearModal()
  if (modal.open) return
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  modal.showModal()
  // El foco inicial va a "Seguir en el mapa", para no llamar por accidente
  modal.querySelector<HTMLElement>('.aviso-seguir')?.focus()
}

/** Abre el modal si la colonia aplica y aún no se mostró en esta visita. Devuelve si aplica. */
export function mostrarAvisoSiAplica(colonia: ColoniaAviso, zonas: ZonaColonia[]): boolean {
  if (!aplicaAviso(colonia, zonas)) return false
  if (idMostrado !== AVISO.id) {
    idMostrado = AVISO.id
    abrirModal()
  }
  return true
}

// ─── Bloque fijo en la hoja de colonia ───

/**
 * Bloque que va arriba del bloque del SIAPA. No se puede cerrar: es la forma de volver a
 * encontrar el número. `actualizar` decide si se ve, con la colonia y zonas que llegaron.
 */
export function crearAvisoEnHoja(): {
  el: HTMLElement
  actualizar: (colonia: ColoniaAviso, zonas: ZonaColonia[]) => boolean
} {
  const el = crearElemento('section', 'cs-block aviso-hoja')
  el.setAttribute('aria-labelledby', 'aviso-hoja-titulo')
  el.hidden = true

  const titulo = crearElemento('h3', 'cs-label', TITULO)
  titulo.id = 'aviso-hoja-titulo'

  el.append(
    titulo,
    crearElemento('p', 'aviso-hoja-texto', 'Tu colonia está en la rotación del SIAPA. Si falta agua, haz el reporte por teléfono.'),
    enlaceLlamar(),
  )

  return {
    el,
    actualizar(colonia, zonas) {
      const aplica = aplicaAviso(colonia, zonas)
      el.hidden = !aplica
      return aplica
    },
  }
}
