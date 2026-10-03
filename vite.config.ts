import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // En desarrollo, /api va al backend local (wawhere-api) sin pelear con CORS
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  // MapLibre crea su worker con { type: 'module' }
  worker: {
    format: 'es',
  },
  build: {
    // maplibre-gl pesa ~1 MB (285 kB gzip) y solo se carga en /mapa/
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      // Dos páginas: la landing no carga nada de MapLibre
      input: {
        main: 'index.html',
        mapa: 'mapa/index.html',
      },
      output: {
        // MapLibre en su propio chunk: cambia poco, así queda en caché entre deploys
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
        },
      },
    },
  },
})
