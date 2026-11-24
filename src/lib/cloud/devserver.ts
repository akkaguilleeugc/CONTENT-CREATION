/* A tiny self-hosted implementation of the cloud contract (scripts/sync-dev-server.cjs), used for
   local development and the automated two-device tests. Only bundled when VITE_SYNC_DEV_URL is set. */
import { CloudError, type AuthEvent, type CloudBackend, type CloudUser, type SyncRow } from './backend';

export function createDevBackend(base: string): CloudBackend {
  const KEY = 'kroopy-dev-auth';
  let session: { token: string; user: CloudUser } | null = null;
  try {
    session = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    session = null;
  }
  const listeners = new Set<(e: AuthEvent, u: CloudUser | null) => void>();
  const emit = (e: AuthEvent) => listeners.forEach((l) => l(e, session?.user ?? null));
  const save = () => (session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY));
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.token}` } : {}), ...(init.headers || {}) } });
    } catch (e) {
      throw new CloudError(String(e), 'network');
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: CloudError['code'] };
      throw new CloudError(body.error || res.statusText, body.code || 'unknown');
    }
    return (res.headers.get('content-type') || '').includes('json') ? ((await res.json()) as T) : ((await res.blob()) as unknown as T);
  }
  return {
    kind: 'dev',
    realtime: true,
    async currentUser() {
      return session?.user ?? null;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signUp(email, password) {
      session = await call('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
      save();
      emit('SIGNED_IN');
      return { user: session!.user, needsConfirmation: false };
    },
    async signIn(email, password) {
      session = await call('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) });
      save();
      emit('SIGNED_IN');
      return session!.user;
    },
    async signOut() {
      session = null;
      save();
      emit('SIGNED_OUT');
    },
    async sendPasswordReset() {
      /* not supported by the dev server */
    },
    async updatePassword(password) {
      await call('/auth/password', { method: 'POST', body: JSON.stringify({ password }) });
    },
    async deleteAccount() {
      await call('/account', { method: 'DELETE' });
      session = null;
      save();
      emit('SIGNED_OUT');
    },
    async pull(since, limit) {
      return call<SyncRow[]>(`/pull?limit=${limit}${since ? `&since=${encodeURIComponent(since)}` : ''}`);
    },
    async push(rows) {
      await call('/push', { method: 'POST', body: JSON.stringify(rows) });
    },
    subscribe(onRow, onStatus) {
      if (!session) return () => {};
      const es = new EventSource(`${base}/events?token=${encodeURIComponent(session.token)}`);
      es.onopen = () => onStatus?.(true);
      es.onerror = () => onStatus?.(false);
      es.onmessage = (m) => onRow(JSON.parse(m.data) as SyncRow);
      return () => es.close();
    },
    async uploadFile(key, blob) {
      if (!session) return;
      await fetch(`${base}/files/${encodeURIComponent(key)}`, { method: 'PUT', body: blob, headers: { authorization: `Bearer ${session.token}`, 'content-type': blob.type || 'application/octet-stream' } });
    },
    async downloadFile(key) {
      if (!session) return null;
      const res = await fetch(`${base}/files/${encodeURIComponent(key)}`, { headers: { authorization: `Bearer ${session.token}` } });
      return res.ok ? res.blob() : null;
    },
    async removeFiles(keys) {
      await call('/files/remove', { method: 'POST', body: JSON.stringify(keys) });
    },
    async removeAllFiles() {
      /* handled by DELETE /account */
    },
  };
}
