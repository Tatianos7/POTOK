/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POTOK_STAGING_GENERATION_CHECK?: string;
  readonly VITE_POTOK_STAGING_GENERATION_ACCOUNT?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

