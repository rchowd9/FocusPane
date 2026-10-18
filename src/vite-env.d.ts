/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALARM_FEED_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
