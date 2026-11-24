/* ──────────────────────────────────────────────────────────────
   Storage for the KROOPY cloud, on Netlify Blobs (no setup needed:
   the site's stores exist as soon as the functions run).

   kroopy-config  secret (token signing key), vapid (push keys)
   kroopy-users   e/<sha256(email)> → { uid }   ·   u/<uid> → account
   kroopy-data    <uid> → everything the person synced (gzip JSON),
                  metadata { t: last change, tv: token version }
   kroopy-files   <uid>/<fileKey>/<part> → uploaded files, in parts
   kroopy-push    <uid> → push subscriptions + upcoming reminders

   Every read-modify-write goes through a conditional write
   (onlyIfNew / onlyIfMatch on the ETag) and retries on conflict, so
   two devices writing at the same moment never overwrite each other.
   ────────────────────────────────────────────────────────────── */
import { getStore, type Store } from '@netlify/blobs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { HttpError, sleep } from './http';

/* Branch deploys and deploy previews get stores of their own: tests on a preview link never read or
   change the real accounts of kroopy.es. Production and local development use the plain names. */
let suffix = '';
export function scopeStores(deployContext: string | undefined) {
  suffix = !deployContext || deployContext === 'production' || deployContext === 'dev' ? '' : '-preview';
}
const open = (name: string): Store => getStore({ name: name + suffix, consistency: 'strong' });
export const configStore = () => open('kroopy-config');
export const usersStore = () => open('kroopy-users');
export const dataStore = () => open('kroopy-data');
export const filesStore = () => open('kroopy-files');
export const pushStore = () => open('kroopy-push');
export const aiStore = () => open('kroopy-ai');

/* ── one person's synced records ── */
export interface StoredRow {
  /** record data (null for a deletion) */
  d: unknown;
  /** deleted */
  x?: 1;
  /** device that wrote it */
  dev?: string | null;
  /** server time of the write, ms — strictly increasing per account */
  t: number;
}
export interface DataState {
  v: 1;
  clock: number;
  /** token version: bumping it signs every device out */
  tv: number;
  rows: Record<string, StoredRow>;
}
export const emptyState = (tv = 1): DataState => ({ v: 1, clock: 0, tv, rows: {} });

const encode = (s: DataState) => new Blob([gzipSync(Buffer.from(JSON.stringify(s)))]);
const decode = (buf: ArrayBuffer) => JSON.parse(gunzipSync(Buffer.from(buf)).toString('utf8')) as DataState;

export async function readState(uid: string): Promise<{ state: DataState; etag: string } | null> {
  const hit = await dataStore().getWithMetadata(uid, { type: 'arrayBuffer' });
  if (!hit || !hit.data) return null;
  return { state: decode(hit.data), etag: hit.etag! };
}

export async function createState(uid: string, state: DataState) {
  const { modified } = await dataStore().set(uid, encode(state), { onlyIfNew: true, metadata: { t: state.clock, tv: state.tv } });
  return modified;
}

/** Applies `fn` to the latest state and writes it back atomically (retries on a concurrent write). */
export async function updateState<T>(uid: string, fn: (s: DataState) => T): Promise<T> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const cur = await readState(uid);
    if (!cur) throw new HttpError(401, 'account_gone', 'This account no longer exists.');
    if (!cur.etag) throw new Error('Blobs returned no ETag: refusing an unsafe write');
    const out = fn(cur.state);
    const { modified } = await dataStore().set(uid, encode(cur.state), { onlyIfMatch: cur.etag, metadata: { t: cur.state.clock, tv: cur.state.tv } });
    if (modified) return out;
    await sleep(15 + Math.random() * 60 * (attempt + 1));
  }
  throw new HttpError(503, 'busy', 'The cloud is busy. Try again in a moment.');
}

/* ── generic JSON read-modify-write with ETags ── */
export async function updateJSON<V, T>(store: Store, key: string, init: () => V | null, fn: (v: V) => T, metadata?: (v: V) => Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const cur = await store.getWithMetadata(key, { type: 'json' });
    let value: V | null = cur?.data ?? null;
    if (value === null) {
      value = init();
      if (value === null) throw new HttpError(404, 'not_found');
    }
    if (cur && !cur.etag) throw new Error('Blobs returned no ETag: refusing an unsafe write');
    const out = fn(value);
    const opts = cur ? { onlyIfMatch: cur.etag! } : { onlyIfNew: true as const };
    const { modified } = await store.setJSON(key, value, { ...opts, metadata: metadata?.(value) });
    if (modified) return out;
    await sleep(15 + Math.random() * 60 * (attempt + 1));
  }
  throw new HttpError(503, 'busy', 'The cloud is busy. Try again in a moment.');
}

/** Reads a value; creates it once (first writer wins) if it doesn't exist yet. */
export async function getOrCreate<V>(store: Store, key: string, make: () => V): Promise<V> {
  const hit = await store.get(key, { type: 'json' });
  if (hit) return hit as V;
  await store.setJSON(key, make(), { onlyIfNew: true });
  return (await store.get(key, { type: 'json' })) as V;
}

/** Deletes every blob whose key starts with `prefix`. */
export async function deletePrefix(store: Store, prefix: string) {
  const { blobs } = await store.list({ prefix });
  for (let i = 0; i < blobs.length; i += 20) await Promise.all(blobs.slice(i, i + 20).map((b) => store.delete(b.key)));
  return blobs.length;
}
