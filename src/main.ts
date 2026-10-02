import './style.css'

// URL del mapa real. Defínela en `.env` como VITE_MAP_URL=https://...
const MAP_URL: string = import.meta.env.VITE_MAP_URL || '#'

document.querySelectorAll<HTMLAnchorElement>('[data-map-link]').forEach((a) => {
  a.href = MAP_URL
})

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
    title: 'wawhere',
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
