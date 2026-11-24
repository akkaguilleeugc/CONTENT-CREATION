/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — enables accounts and sync between devices. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Never a service-role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Local sync server for development and automated tests (scripts/sync-dev-server.cjs). */
  readonly VITE_SYNC_DEV_URL?: string;
  /** Where KROOPY's own cloud answers (default: /api on the same site). */
  readonly VITE_CLOUD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
