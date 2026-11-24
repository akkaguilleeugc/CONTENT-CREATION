/* ──────────────────────────────────────────────────────────────
   Account sync between devices.

   KROOPY stays local-first: everything is saved on the device and
   works offline. When you sign in, this engine keeps the device and
   your account in step:

   • every local change (insert, edit, delete) is queued in an outbox
     that survives reloads and offline periods, then pushed;
   • changes from your other devices arrive live (Realtime) and on
     every return to the app, ordered by the server clock;
   • the latest write wins; deletions travel as tombstones;
   • uploaded files go to private Storage and download on demand.

   Without a configured backend (no VITE_SUPABASE_URL) the app simply
   keeps working on this device only.
   ────────────────────────────────────────────────────────────── */
import { create } from 'zustand';
import { CloudError, type CloudBackend, type CloudUser, type SyncRow } from './cloud/backend';
import { freshDB, migrate } from './factories';
import { $t } from './i18n';
import { localFiles, setRemoteFileSource } from './persistence';
import { applyExternal, isExternalApply, snapshot, useStore } from './store';
import type { DB } from './types';
import { confirmDialog, toast } from './ui';
import { uid } from './utils';

export type SyncStatus = 'unconfigured' | 'loading' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  user: CloudUser | null;
  lastSyncAt: number | null;
  pending: number;
  live: boolean;
  error: string | null;
  /** The person opened a password-reset link: ask for a new password. */
  recovery: boolean;
}

export const useSync = create<SyncState>(() => ({ status: 'loading', user: null, lastSyncAt: null, pending: 0, live: false, error: null, recovery: false }));

const ARRAYS = ['ideas', 'projects', 'tasks', 'habits', 'habitLogs', 'goals', 'goalProgress', 'timeLogs', 'events', 'analytics', 'assets', 'folders', 'palettes', 'colors', 'combos', 'references', 'brandFonts'] as const;
type ArrayKey = (typeof ARRAYS)[number];
const SINGLES = ['brand', 'settings'] as const;
type Rec = { id: string; demo?: boolean; system?: boolean; blobKey?: string };

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};
const DEVICE = (() => {
  let d = ls.get('kroopy:device');
  if (!d) {
    d = uid();
    ls.set('kroopy:device', d);
  }
  return d;
})();

/* ── backend (lazy: the cloud code only loads when it's configured) ── */
let backendP: Promise<CloudBackend | null> | null = null;
export const cloudConfigured = !!(import.meta.env.VITE_SYNC_DEV_URL || (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY));
function backend(): Promise<CloudBackend | null> {
  if (!backendP)
    backendP = (async () => {
      if (import.meta.env.VITE_SYNC_DEV_URL) return (await import('./cloud/devserver')).createDevBackend(import.meta.env.VITE_SYNC_DEV_URL);
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
        return (await import('./cloud/supabase')).createSupabaseBackend(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
      return null;
    })();
  return backendP;
}

/* ── outbox: keys of records changed on this device and not yet in the cloud ── */
type Pending = { c: string; id: string; at: number; del?: boolean; blobKey?: string };
const OUTBOX_KEY = 'kroopy:sync-outbox';
let outbox = new Map<string, Pending>();
try {
  for (const p of JSON.parse(ls.get(OUTBOX_KEY) || '[]') as Pending[]) outbox.set(`${p.c}:${p.id}`, p);
} catch {
  outbox = new Map();
}
let outboxTimer: ReturnType<typeof setTimeout> | null = null;
const saveOutbox = () => {
  useSync.setState({ pending: outbox.size });
  if (outboxTimer) return;
  outboxTimer = setTimeout(() => {
    outboxTimer = null;
    ls.set(OUTBOX_KEY, JSON.stringify([...outbox.values()]));
  }, 120);
};
function mark(c: string, id: string, del = false, blobKey?: string) {
  outbox.set(`${c}:${id}`, { c, id, at: Date.now(), del, blobKey });
  saveOutbox();
}

const cursorKey = (u: string) => `kroopy:sync-cursor:${u}`;
const uploadedKey = (u: string) => `kroopy:sync-files:${u}`;
let uploaded = new Set<string>();

/* ── watch local edits ── */
function watchLocal() {
  return useStore.subscribe((s, prev) => {
    if (s.rev === prev.rev || isExternalApply()) return;
    let touched = false;
    for (const c of ARRAYS) {
      if (s[c] === prev[c]) continue;
      const before = new Map((prev[c] as Rec[]).map((r) => [r.id, r]));
      for (const r of s[c] as Rec[]) {
        if (before.get(r.id) !== r) {
          mark(c, r.id);
          touched = true;
        }
        before.delete(r.id);
      }
      for (const [id, r] of before) {
        mark(c, id, true, c === 'assets' ? r.blobKey : undefined);
        touched = true;
      }
    }
    for (const k of SINGLES)
      if (s[k] !== prev[k]) {
        mark('_single', k);
        touched = true;
      }
    if (touched) schedulePush();
  });
}

/* ── apply rows from the cloud ── */
function apply(rows: SyncRow[], opts: { force?: boolean } = {}) {
  if (!rows.length) return 0;
  const s = useStore.getState();
  const patch: Partial<Record<ArrayKey | 'brand' | 'settings', unknown>> = {};
  const maps = new Map<ArrayKey, { map: Map<string, Rec>; fresh: Rec[] }>();
  let changed = 0;
  for (const r of rows) {
    if (!opts.force && r.device === DEVICE) continue;
    if (!opts.force && outbox.has(`${r.collection}:${r.id}`)) continue; // a newer local edit is on its way up
    if (r.collection === '_single') {
      if ((r.id === 'brand' || r.id === 'settings') && !r.deleted && r.data && JSON.stringify(s[r.id]) !== JSON.stringify(r.data)) {
        patch[r.id] = r.data;
        changed++;
      }
      continue;
    }
    if (!(ARRAYS as readonly string[]).includes(r.collection)) continue;
    const c = r.collection as ArrayKey;
    let m = maps.get(c);
    if (!m) {
      m = { map: new Map((s[c] as Rec[]).map((x) => [x.id, x])), fresh: [] };
      maps.set(c, m);
    }
    if (r.deleted) {
      if (m.map.delete(r.id)) changed++;
      m.fresh = m.fresh.filter((x) => x.id !== r.id);
    } else {
      const cur = m.map.get(r.id);
      if (!cur) {
        m.fresh.push(r.data as Rec);
        m.map.set(r.id, r.data as Rec);
        changed++;
      } else if (JSON.stringify(cur) !== JSON.stringify(r.data)) {
        m.map.set(r.id, r.data as Rec);
        changed++;
      }
    }
  }
  for (const [c, m] of maps) {
    const freshIds = new Set(m.fresh.map((x) => x.id));
    patch[c] = [...m.fresh.reverse(), ...[...m.map.values()].filter((x) => !freshIds.has(x.id))];
  }
  if (!changed) return 0;
  applyExternal(() => useStore.setState((st) => ({ ...migrate({ ...snapshot(st), ...(patch as Partial<DB>) }), rev: st.rev + 1 })));
  return changed;
}

/* ── push / pull ── */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
function schedulePush(delay = 500) {
  if (!useSync.getState().user) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), delay);
}

function rowFor(p: Pending, s: ReturnType<typeof useStore.getState>): SyncRow {
  if (p.c === '_single') return { collection: '_single', id: p.id, data: s[p.id as 'brand' | 'settings'], deleted: false, device: DEVICE };
  const rec = (s[p.c as ArrayKey] as Rec[]).find((r) => r.id === p.id);
  return rec ? { collection: p.c, id: p.id, data: rec, deleted: false, device: DEVICE } : { collection: p.c, id: p.id, data: null, deleted: true, device: DEVICE };
}

async function pushNow() {
  const be = await backend();
  const user = useSync.getState().user;
  if (!be || !user || pushing || outbox.size === 0) return;
  if (!navigator.onLine) return void useSync.setState({ status: 'offline' });
  pushing = true;
  useSync.setState({ status: 'syncing' });
  const batch = [...outbox.values()];
  const s = useStore.getState();
  try {
    await be.push(batch.map((p) => rowFor(p, s)));
    // files that belong to the pushed assets
    for (const p of batch.filter((x) => x.c === 'assets')) {
      try {
        if (p.del) {
          if (p.blobKey) await be.removeFiles([p.blobKey]);
        } else {
          const a = s.assets.find((x) => x.id === p.id);
          if (a?.blobKey && !uploaded.has(a.blobKey)) {
            const blob = await localFiles.get(a.blobKey);
            if (blob) {
              await be.uploadFile(a.blobKey, blob);
              uploaded.add(a.blobKey);
              ls.set(uploadedKey(user.id), JSON.stringify([...uploaded]));
            }
          }
        }
      } catch (e) {
        console.warn('[kroopy] file sync skipped', e);
      }
    }
    for (const p of batch) {
      const k = `${p.c}:${p.id}`;
      if (outbox.get(k)?.at === p.at) outbox.delete(k);
    }
    saveOutbox();
    useSync.setState({ status: outbox.size ? 'syncing' : 'synced', lastSyncAt: Date.now(), error: null });
  } catch (e) {
    fail(e);
  } finally {
    pushing = false;
    if (outbox.size) schedulePush(navigator.onLine ? 1500 : 8000);
  }
}

async function pullNow() {
  const be = await backend();
  const user = useSync.getState().user;
  if (!be || !user) return;
  if (!navigator.onLine) return void useSync.setState({ status: 'offline' });
  try {
    let cursor = ls.get(cursorKey(user.id));
    // Re-read the last few seconds: a write committed just after our last read can carry an earlier timestamp.
    let since = cursor ? new Date(Date.parse(cursor) - 10_000).toISOString() : null;
    for (;;) {
      const rows = await be.pull(since, 1000);
      apply(rows);
      const last = rows[rows.length - 1]?.updated_at;
      if (last && (!cursor || last > cursor)) cursor = last;
      if (rows.length < 1000) break;
      since = last ?? since;
    }
    if (cursor) ls.set(cursorKey(user.id), cursor);
    useSync.setState({ status: outbox.size ? 'syncing' : 'synced', lastSyncAt: Date.now(), error: null });
  } catch (e) {
    fail(e);
  }
}

function fail(e: unknown) {
  const offline = !navigator.onLine || (e instanceof CloudError && e.code === 'network');
  useSync.setState({ status: offline ? 'offline' : 'error', error: offline ? null : e instanceof Error ? e.message : String(e) });
  if (!offline) console.warn('[kroopy] sync error', e);
}

/* ── sessions ── */
const hasOwnData = (s = useStore.getState()) => ARRAYS.some((c) => (s[c] as Rec[]).some((r) => !r.demo && !r.system));

async function pullAll(be: CloudBackend) {
  const out: SyncRow[] = [];
  let since: string | null = null;
  for (;;) {
    const rows = await be.pull(since, 1000);
    out.push(...rows);
    if (rows.length < 1000) break;
    since = rows[rows.length - 1]!.updated_at ?? null;
  }
  return out;
}

let stop: (() => void) | null = null;

async function startSession(user: CloudUser) {
  const be = await backend();
  if (!be) return;
  stopSession();
  useSync.setState({ user, status: 'syncing', error: null });
  uploaded = new Set(JSON.parse(ls.get(uploadedKey(user.id)) || '[]') as string[]);
  const owner = ls.get('kroopy:sync-owner');

  if (owner && owner !== user.id) {
    // This device was last synced with another account: never mix two people's data.
    if (hasOwnData()) {
      const ok = await confirmDialog({
        title: $t('Replace the data on this device?'),
        description: $t('This device holds data from another account. Signing in as {email} replaces it with that account’s data.', { email: user.email }),
        confirmLabel: $t('Replace'),
        tone: 'default',
      });
      if (!ok) {
        await be.signOut().catch(() => undefined);
        useSync.setState({ user: null, status: 'signed-out' });
        return;
      }
    }
    outbox.clear();
    saveOutbox();
    ls.set(cursorKey(user.id), null);
    applyExternal(() => useStore.setState((st) => ({ ...freshDB(), rev: st.rev + 1 })));
  }

  try {
    if (!ls.get(cursorKey(user.id))) {
      // First sync of this account on this device.
      const remote = await pullAll(be);
      const alive = remote.filter((r) => !r.deleted);
      if (alive.length === 0) {
        const s = useStore.getState();
        for (const c of ARRAYS) for (const r of s[c] as Rec[]) mark(c, r.id);
        for (const k of SINGLES) mark('_single', k);
      } else if (!hasOwnData()) {
        // A new device (empty, or only sample data): take the account's data as is.
        const db: Partial<DB> = {};
        for (const c of ARRAYS) (db as Record<string, unknown>)[c] = [];
        for (const r of alive) {
          if (r.collection === '_single') (db as Record<string, unknown>)[r.id] = r.data;
          else if ((ARRAYS as readonly string[]).includes(r.collection)) ((db as Record<string, unknown[]>)[r.collection] as unknown[]).push(r.data);
        }
        for (const c of ARRAYS) ((db as Record<string, Rec[]>)[c] as Rec[]).reverse();
        outbox.clear();
        saveOutbox();
        applyExternal(() => useStore.setState((st) => ({ ...migrate({ ...freshDB(), ...db, firedReminders: st.firedReminders }), rev: st.rev + 1 })));
      } else {
        // Both sides have data: merge. Same record on both → the account's copy; local-only records go up.
        apply(remote, { force: true });
        const inCloud = new Set(alive.map((r) => `${r.collection}:${r.id}`));
        const s = useStore.getState();
        for (const c of ARRAYS) for (const r of s[c] as Rec[]) if (!inCloud.has(`${c}:${r.id}`)) mark(c, r.id);
        for (const k of SINGLES) if (!inCloud.has(`_single:${k}`)) mark('_single', k);
      }
      const last = remote[remote.length - 1]?.updated_at;
      ls.set(cursorKey(user.id), last ?? new Date(0).toISOString());
    } else {
      await pullNow();
    }
  } catch (e) {
    fail(e);
  }
  ls.set('kroopy:sync-owner', user.id);

  const unwatch = watchLocal();
  const unsub = be.subscribe(
    (row) => {
      apply([row]);
      const cur = ls.get(cursorKey(user.id));
      if (row.updated_at && (!cur || row.updated_at > cur)) ls.set(cursorKey(user.id), row.updated_at);
      useSync.setState({ lastSyncAt: Date.now() });
    },
    (live) => {
      useSync.setState({ live });
      if (live) void pullNow(); // catch up on anything missed while reconnecting
    },
  );
  setRemoteFileSource((key) => be.downloadFile(key));
  const onOnline = () => {
    void pullNow().then(() => pushNow());
  };
  const onOffline = () => useSync.setState({ status: 'offline' });
  const onVisible = () => document.visibilityState === 'visible' && onOnline();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => document.visibilityState === 'visible' && void pullNow(), 60_000);
  stop = () => {
    unwatch();
    unsub();
    setRemoteFileSource(null);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
  if (!navigator.onLine) useSync.setState({ status: 'offline' });
  else useSync.setState({ status: outbox.size ? 'syncing' : 'synced', lastSyncAt: Date.now() });
  schedulePush(50);
}

function stopSession() {
  stop?.();
  stop = null;
  if (pushTimer) clearTimeout(pushTimer);
}

/* ── public API ── */
export async function initSync() {
  const be = await backend();
  if (!be) return void useSync.setState({ status: 'unconfigured' });
  be.onAuthChange((event, user) => {
    if (event === 'PASSWORD_RECOVERY') useSync.setState({ recovery: true });
    if (event === 'SIGNED_IN' && user && useSync.getState().user?.id !== user.id) void startSession(user);
    if (event === 'SIGNED_OUT' && useSync.getState().user) {
      stopSession();
      useSync.setState({ user: null, status: 'signed-out', live: false });
    }
  });
  const user = await be.currentUser().catch(() => null);
  if (user) await startSession(user);
  else useSync.setState({ status: 'signed-out' });
}

export async function signUp(email: string, password: string) {
  const be = await backend();
  if (!be) throw new CloudError('Cloud sync is not configured', 'unknown');
  const res = await be.signUp(email.trim(), password);
  if (res.user) await startSession(res.user);
  return res;
}

export async function signIn(email: string, password: string) {
  const be = await backend();
  if (!be) throw new CloudError('Cloud sync is not configured', 'unknown');
  const user = await be.signIn(email.trim(), password);
  if (useSync.getState().user?.id !== user.id) await startSession(user);
  return user;
}

export async function signOut() {
  const be = await backend();
  stopSession();
  await be?.signOut().catch(() => undefined);
  useSync.setState({ user: null, status: 'signed-out', live: false });
}

export async function sendPasswordReset(email: string) {
  const be = await backend();
  await be?.sendPasswordReset(email.trim());
}

export async function updatePassword(password: string) {
  const be = await backend();
  await be?.updatePassword(password);
  useSync.setState({ recovery: false });
}

/** Deletes the account and everything stored in the cloud. The copy on this device is kept unless `wipeLocal`. */
export async function deleteAccount(wipeLocal: boolean) {
  const be = await backend();
  const user = useSync.getState().user;
  if (!be || !user) return;
  stopSession();
  await be.deleteAccount();
  ls.set(cursorKey(user.id), null);
  ls.set(uploadedKey(user.id), null);
  ls.set('kroopy:sync-owner', null);
  outbox.clear();
  saveOutbox();
  useSync.setState({ user: null, status: 'signed-out', live: false });
  if (wipeLocal) await useStore.getState().resetAll();
}

/** Push and pull right now (the "Sync now" button). */
export async function syncNow() {
  await pullNow();
  await pushNow();
  if (useSync.getState().status === 'synced') toast($t('Everything is up to date'));
}

/** Short status line for the sidebar and the Account page. */
export function syncLabel(status: SyncStatus, pending: number) {
  switch (status) {
    case 'synced':
      return $t('Synced');
    case 'syncing':
      return pending ? $t('Syncing {n} changes…', { n: pending }) : $t('Syncing…');
    case 'offline':
      return $t('Offline — saved on this device');
    case 'error':
      return $t('Sync paused');
    default:
      return $t('Saved locally');
  }
}

