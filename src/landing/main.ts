import '../shared/tokens.css'
import './landing.css'

// Por defecto el mapa vive en /mapa/. Puedes sobreescribirlo con VITE_MAP_URL
const MAP_URL: string = import.meta.env.VITE_MAP_URL || '/mapa/'

document.querySelectorAll<HTMLAnchorElement>('[data-map-link]').forEach((a) => {
  a.href = MAP_URL
})

// Menú: en móvil se despliega con el botón; en escritorio siempre está visible
const header = document.querySelector<HTMLElement>('.site-header')
const nav = document.querySelector<HTMLElement>('#site-nav')
const navToggle = document.querySelector<HTMLButtonElement>('.nav-toggle')

if (header && nav && navToggle) {
  header.classList.add('has-js')
  navToggle.hidden = false

  const setMenu = (open: boolean) => {
    nav.classList.toggle('is-open', open)
    navToggle.setAttribute('aria-expanded', String(open))
    navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú')
  }

  navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')))
  nav.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) setMenu(false)
  })
  document.addEventListener('click', (e) => {
    if (!header.contains(e.target as Node)) setMenu(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false)
      navToggle.focus()
    }
  })
  matchMedia('(min-width: 881px)').addEventListener('change', (e) => e.matches && setMenu(false))

  // Línea bajo el header solo cuando ya hay contenido detrás
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })

  // Resalta en el menú la sección que se está leyendo
  const links = new Map<string, HTMLAnchorElement>()
  nav.querySelectorAll<HTMLAnchorElement>('ul a[href^="#"]').forEach((a) => links.set(a.hash.slice(1), a))
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        links.forEach((a, id) => {
          if (id === entry.target.id) a.setAttribute('aria-current', 'true')
          else a.removeAttribute('aria-current')
        })
      }
    },
    // Franja horizontal a un tercio de la pantalla: la sección que la cruza es la "actual"
    { rootMargin: '-35% 0px -60% 0px' },
  )
  document.querySelectorAll<HTMLElement>('main section[id]').forEach((sec) => observer.observe(sec))
}

// Solo una pregunta abierta a la vez
const questions = document.querySelectorAll<HTMLDetailsElement>('.faq details')
questions.forEach((d) => {
  d.addEventListener('toggle', () => {
    if (!d.open) return
    questions.forEach((other) => {
      if (other !== d) other.open = false
    })
  })
})

const shareBtn = document.querySelector<HTMLButtonElement>('#share-btn')
const shareStatus = document.querySelector<HTMLElement>('#share-status')

shareBtn?.addEventListener('click', async () => {
  const data = {
    title: 'aguajalisco',
    text: '¿Hay agua en tu colonia? Mapa colaborativo de Guadalajara.',
    url: window.location.href,
  }
  try {
    if (navigator.share) {
      await navigator.share(data)
      return
    }
    await navigator.clipboard.writeText(data.url)
    if (shareStatus) shareStatus.textContent = 'Enlace copiado.'
  } catch (err) {
    if ((err as DOMException).name !== 'AbortError' && shareStatus) {
      shareStatus.textContent = 'No se pudo compartir. Copia el enlace de la barra de direcciones.'
    }
  }
})
