/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
