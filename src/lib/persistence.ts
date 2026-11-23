/* ──────────────────────────────────────────────────────────────
   Persistence layer.

   The app talks to two small interfaces — `DataAdapter` for structured
   records and `FileAdapter` for binary files — so the local IndexedDB
   implementation below can later be replaced by a Supabase (Postgres +
   Storage) implementation without changing any UI code.
   ────────────────────────────────────────────────────────────── */
import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import type { DB } from './types';

export interface DataAdapter {
  load(): Promise<DB | null>;
  save(db: DB): Promise<void>;
  clear(): Promise<void>;
}

export interface FileAdapter {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
  remove(key: string): Promise<void>;
}

const DB_KEY = 'creator-os:db';
const LS_KEY = 'creator-os:db-fallback';

let dataStore: UseStore | null = null;
let fileStore: UseStore | null = null;
let idbAvailable = typeof indexedDB !== 'undefined';

function stores() {
  if (!dataStore) dataStore = createStore('creator-os', 'records');
  if (!fileStore) fileStore = createStore('creator-os-files', 'blobs');
  return { dataStore, fileStore };
}

export const localData: DataAdapter = {
  async load() {
    if (idbAvailable) {
      try {
        const v = await get<DB>(DB_KEY, stores().dataStore);
        if (v) return v;
      } catch (e) {
        console.warn('[creator-os] IndexedDB unavailable, falling back to localStorage', e);
        idbAvailable = false;
      }
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as DB) : null;
    } catch {
      return null;
    }
  },
  async save(db) {
    if (idbAvailable) {
      try {
        await set(DB_KEY, db, stores().dataStore);
        return;
      } catch (e) {
        console.warn('[creator-os] IndexedDB write failed, falling back to localStorage', e);
        idbAvailable = false;
      }
    }
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  },
  async clear() {
    try {
      if (idbAvailable) await del(DB_KEY, stores().dataStore);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const localFiles: FileAdapter = {
  async put(key, blob) {
    await set(key, blob, stores().fileStore);
  },
  async get(key) {
    try {
      return await get<Blob>(key, stores().fileStore);
    } catch {
      return undefined;
    }
  },
  async remove(key) {
    try {
      await del(key, stores().fileStore);
    } catch {
      /* ignore */
    }
  },
};

/* Cross-tab sync: when another tab saves, this tab reloads its snapshot. */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('creator-os') : null;
export const TAB_ID = Math.random().toString(36).slice(2);

export function announceSave(rev: number) {
  channel?.postMessage({ type: 'saved', tab: TAB_ID, rev });
}
export function onRemoteSave(cb: () => void) {
  if (!channel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'saved' && e.data.tab !== TAB_ID) cb();
  };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

/* Object-URL cache for stored files, shared by every preview. */
const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function fileUrl(key: string): Promise<string | null> {
  const cached = urlCache.get(key);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(key);
  if (!p) {
    p = localFiles.get(key).then((blob) => {
      pending.delete(key);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urlCache.set(key, url);
      return url;
    });
    pending.set(key, p);
  }
  return p;
}
export const cachedFileUrl = (key?: string) => (key ? urlCache.get(key) ?? null : null);
export function forgetFileUrl(key: string) {
  const u = urlCache.get(key);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(key);
}
