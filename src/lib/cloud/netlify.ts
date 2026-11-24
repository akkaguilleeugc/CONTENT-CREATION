/* KROOPY's own cloud — the /api functions deployed with the app (netlify/functions/api.mts).
   Same origin, so there is nothing to configure: no keys, no third-party account. */
import { CloudError, type AuthEvent, type CloudBackend, type CloudUser, type PushApi, type SyncRow } from './backend';

const KEY = 'kroopy-cloud-session';
const PART = 3_500_000; // bytes per uploaded file part
const BATCH = 2_500_000; // max JSON bytes per sync push

type Session = { token: string; user: CloudUser };
const CODES = new Set<CloudError['code']>(['invalid_credentials', 'email_taken', 'weak_password', 'rate_limited', 'invalid_recovery_key', 'session_expired']);

export function createNetlifyBackend(base = '/api'): CloudBackend {
  let session: Session | null = null;
  try {
    session = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    session = null;
  }
  const listeners = new Set<(e: AuthEvent, u: CloudUser | null) => void>();
  const emit = (e: AuthEvent) => listeners.forEach((l) => l(e, session?.user ?? null));
  const save = () => {
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked: the session lasts until the tab closes */
    }
  };
  const setSession = (s: Session | null, event?: AuthEvent) => {
    session = s;
    save();
    if (event) emit(event);
  };

  async function request(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(base + path, {
        ...init,
        cache: 'no-store',
        headers: { ...(auth && session ? { authorization: `Bearer ${session.token}` } : {}), ...(init.headers || {}) },
      });
    } catch (e) {
      throw new CloudError(String(e), 'network');
    }
    const renewed = res.headers.get('x-kroopy-token');
    if (renewed && session) setSession({ ...session, token: renewed });
    if (res.ok) return res;
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (res.status === 401 && auth && session && (body.code === 'session_expired' || body.code === 'account_gone')) setSession(null, 'SESSION_EXPIRED');
    const code = (CODES.has(body.code as CloudError['code']) ? body.code : body.code === 'account_gone' ? 'session_expired' : 'unknown') as CloudError['code'];
    throw new CloudError(body.error || `${res.status} ${res.statusText}`, code);
  }
  const call = async <T,>(path: string, init: RequestInit = {}, auth = true): Promise<T> => {
    const res = await request(path, { ...init, headers: { ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) } }, auth);
    return (await res.json()) as T;
  };
  const post = <T,>(path: string, data: unknown, auth = true) => call<T>(path, { method: 'POST', body: JSON.stringify(data) }, auth);

  const notifications: PushApi = {
    async publicKey() {
      return (await call<{ publicKey: string }>('/push/key', {}, false)).publicKey;
    },
    async subscribe(subscription, device) {
      await post('/push/subscribe', { subscription, device });
    },
    async unsubscribe(endpoint, device) {
      await post('/push/unsubscribe', { endpoint, device });
    },
    async schedule(items) {
      return call<{ devices: number; upcoming: number }>('/push/schedule', { method: 'PUT', body: JSON.stringify({ items }) });
    },
    async test(device, title, body) {
      return post<{ sent: number }>('/push/test', { device, title, body });
    },
  };

  return {
    kind: 'netlify',
    realtime: false,
    notifications,
    async available() {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 8000);
        const res = await fetch(`${base}/health`, { cache: 'no-store', signal: ctl.signal });
        clearTimeout(t);
        if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return false;
        return !!((await res.json()) as { ok?: boolean }).ok;
      } catch {
        return null; // offline or timed out: can't tell
      }
    },
    async currentUser() {
      return session?.user ?? null;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signUp(email, password) {
      const res = await post<Session & { recoveryKey: string }>('/auth/signup', { email, password }, false);
      setSession({ token: res.token, user: res.user }, 'SIGNED_IN');
      return { user: res.user, needsConfirmation: false, recoveryKey: res.recoveryKey };
    },
    async signIn(email, password) {
      const res = await post<Session>('/auth/signin', { email, password }, false);
      setSession({ token: res.token, user: res.user }, 'SIGNED_IN');
      return res.user;
    },
    async signOut() {
      setSession(null, 'SIGNED_OUT');
    },
    async sendPasswordReset() {
      /* no email from this cloud: forgotten passwords use the recovery key */
    },
    async resetWithRecoveryKey(email, recoveryKey, password) {
      const res = await post<Session>('/auth/reset', { email, recoveryKey, password }, false);
      setSession({ token: res.token, user: res.user }, 'SIGNED_IN');
      return res.user;
    },
    async updatePassword(password) {
      const res = await post<{ token: string }>('/auth/password', { password });
      if (session) setSession({ ...session, token: res.token });
    },
    async newRecoveryKey() {
      return (await post<{ recoveryKey: string }>('/auth/recovery', {})).recoveryKey;
    },
    async deleteAccount() {
      await call('/account', { method: 'DELETE' });
      setSession(null, 'SIGNED_OUT');
    },
    async pull(since, limit) {
      return call<SyncRow[]>(`/sync?limit=${limit}${since ? `&since=${encodeURIComponent(since)}` : ''}`);
    },
    async push(rows) {
      // Several requests when there is a lot to send (first sync of a full device).
      let batch: SyncRow[] = [];
      let size = 0;
      for (const r of rows) {
        const n = JSON.stringify(r).length;
        if (batch.length && size + n > BATCH) {
          await post('/sync', batch);
          batch = [];
          size = 0;
        }
        batch.push(r);
        size += n;
      }
      if (batch.length) await post('/sync', batch);
    },
    subscribe() {
      return () => {}; // no live channel: the sync engine polls
    },
    async uploadFile(key, blob) {
      if (!session) return;
      const parts = Math.max(1, Math.ceil(blob.size / PART));
      for (let i = 0; i < parts; i++)
        await request(`/files/${encodeURIComponent(key)}?part=${i}&parts=${parts}`, {
          method: 'PUT',
          body: blob.slice(i * PART, (i + 1) * PART),
          headers: { 'content-type': blob.type || 'application/octet-stream' },
        });
    },
    async downloadFile(key) {
      if (!session) return null;
      try {
        const first = await request(`/files/${encodeURIComponent(key)}`);
        const parts = Number(first.headers.get('x-parts') || 1);
        const type = first.headers.get('content-type') || 'application/octet-stream';
        const chunks: Blob[] = [await first.blob()];
        for (let i = 1; i < parts; i++) chunks.push(await (await request(`/files/${encodeURIComponent(key)}?part=${i}`)).blob());
        return new Blob(chunks, { type });
      } catch {
        return null;
      }
    },
    async removeFiles(keys) {
      if (keys.length) await post('/files/remove', keys);
    },
    async removeAllFiles() {
      /* DELETE /api/account removes them */
    },
  };
}
