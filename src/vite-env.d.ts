/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_MAP_STYLE_URL?: string
  readonly VITE_REPORT_EXPIRY_HOURS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
