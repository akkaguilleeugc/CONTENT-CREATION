/* Supabase implementation of the cloud contract: Auth (email + password), Postgres
   (public.sync_records, see supabase/migrations/0003_sync.sql), Realtime and Storage. */
import { createClient, type AuthChangeEvent, type SupabaseClient, type User } from '@supabase/supabase-js';
import { CloudError, type AuthEvent, type CloudBackend, type CloudUser, type SyncRow } from './backend';

const BUCKET = 'assets';
const toUser = (u: User | null | undefined): CloudUser | null => (u ? { id: u.id, email: u.email ?? '' } : null);

function mapError(e: unknown): CloudError {
  const err = e as { message?: string; status?: number; code?: string; name?: string };
  const msg = err?.message || String(e);
  const code = err?.code || '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return new CloudError(msg, 'invalid_credentials');
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return new CloudError(msg, 'email_taken');
  if (code === 'weak_password' || /password should be/i.test(msg)) return new CloudError(msg, 'weak_password');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return new CloudError(msg, 'not_confirmed');
  if (err?.status === 429 || /rate limit/i.test(msg)) return new CloudError(msg, 'rate_limited');
  if (/fetch|network|failed to/i.test(msg)) return new CloudError(msg, 'network');
  return new CloudError(msg, 'unknown');
}

export function createSupabaseBackend(url: string, anonKey: string): CloudBackend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kroopy-auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const uid = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new CloudError('Not signed in', 'invalid_credentials');
    return id;
  };
  const redirect = () => `${window.location.origin}/account`;

  return {
    kind: 'supabase',
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event: AuthChangeEvent, session) => cb(event as AuthEvent, toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
      if (error) throw mapError(error);
      // With "Confirm email" on, Supabase returns a user without a session until the link is opened.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new CloudError('Email already registered', 'email_taken');
      return { user: toUser(data.session?.user), needsConfirmation: !data.session };
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw mapError(error);
      return toUser(data.user)!;
    },
    async signOut() {
      await sb.removeAllChannels();
      const { error } = await sb.auth.signOut();
      if (error) throw mapError(error);
    },
    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${redirect()}?reset=1` });
      if (error) throw mapError(error);
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw mapError(error);
    },
    async deleteAccount() {
      await this.removeAllFiles().catch(() => undefined);
      const { error } = await sb.rpc('delete_my_account');
      if (error) throw mapError(error);
      await sb.removeAllChannels();
      await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },

    async pull(since, limit) {
      let q = sb.from('sync_records').select('collection,id,data,deleted,device,updated_at').order('updated_at', { ascending: true }).limit(limit);
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw mapError(error);
      return (data ?? []) as SyncRow[];
    },
    async push(rows) {
      const user_id = await uid();
      const payload = rows.map((r) => ({ user_id, collection: r.collection, id: r.id, data: r.deleted ? null : r.data, deleted: r.deleted, device: r.device ?? null }));
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await sb.from('sync_records').upsert(payload.slice(i, i + 200), { onConflict: 'user_id,collection,id' });
        if (error) throw mapError(error);
      }
    },
    subscribe(onRow, onStatus) {
      let channel: ReturnType<SupabaseClient['channel']> | null = null;
      let stopped = false;
      void (async () => {
        const id = await uid().catch(() => null);
        if (!id || stopped) return;
        channel = sb
          .channel(`sync:${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_records', filter: `user_id=eq.${id}` }, (payload) => {
            const row = payload.new as SyncRow & { user_id?: string };
            if (row && row.collection) onRow({ collection: row.collection, id: row.id, data: row.data, deleted: row.deleted, device: row.device, updated_at: row.updated_at });
          })
          .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'));
      })();
      return () => {
        stopped = true;
        if (channel) void sb.removeChannel(channel);
      };
    },

    async uploadFile(key, blob) {
      const id = await uid();
      const { error } = await sb.storage.from(BUCKET).upload(`${id}/${key}`, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
      if (error) throw mapError(error);
    },
    async downloadFile(key) {
      const id = await uid();
      const { data, error } = await sb.storage.from(BUCKET).download(`${id}/${key}`);
      if (error) return null;
      return data;
    },
    async removeFiles(keys) {
      if (!keys.length) return;
      const id = await uid();
      await sb.storage.from(BUCKET).remove(keys.map((k) => `${id}/${k}`));
    },
    async removeAllFiles() {
      const id = await uid();
      for (;;) {
        const { data, error } = await sb.storage.from(BUCKET).list(id, { limit: 100 });
        if (error || !data?.length) return;
        await sb.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`));
        if (data.length < 100) return;
      }
    },
  };
}
