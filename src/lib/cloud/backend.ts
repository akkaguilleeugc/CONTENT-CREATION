/* The cloud contract the sync engine talks to.
   • netlify  — KROOPY's own cloud, served by the same site (netlify/functions/api.mts). The default.
   • supabase — optional alternative when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (./supabase.ts).
   • dev      — tiny local server for tests (./devserver.ts). */

export interface CloudUser {
  id: string;
  email: string;
}

/** One stored document: a record of a collection, or a soft-deleted tombstone. */
export interface SyncRow {
  collection: string;
  id: string;
  data: unknown | null;
  deleted: boolean;
  device?: string | null;
  /** Server time of the last write — the sync cursor. */
  updated_at?: string;
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'SESSION_EXPIRED' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION';

/** A reminder the cloud delivers as a push notification at `at` (epoch ms). */
export interface PushItem {
  key: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

export interface PushApi {
  publicKey(): Promise<string>;
  subscribe(subscription: PushSubscriptionJSON, device: string): Promise<void>;
  unsubscribe(endpoint: string | null, device: string): Promise<void>;
  schedule(items: PushItem[]): Promise<{ devices: number; upcoming: number }>;
  test(device: string, title: string, body: string): Promise<{ sent: number }>;
}

export interface CloudBackend {
  readonly kind: 'supabase' | 'dev' | 'netlify';
  /** false: no live channel — the sync engine polls (quickly while you're using the app). */
  readonly realtime: boolean;
  /** Whether the cloud answers on this site: true / false, or null when it can't be told (offline). */
  available?(): Promise<boolean | null>;
  currentUser(): Promise<CloudUser | null>;
  onAuthChange(cb: (event: AuthEvent, user: CloudUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<{ user: CloudUser | null; needsConfirmation: boolean; recoveryKey?: string }>;
  signIn(email: string, password: string): Promise<CloudUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** Forgotten password without email: the recovery key shown when the account was created. */
  resetWithRecoveryKey?(email: string, recoveryKey: string, password: string): Promise<CloudUser>;
  newRecoveryKey?(): Promise<string>;
  deleteAccount(): Promise<void>;

  /** Rows changed after `since` (server time), oldest first, at most `limit`. */
  pull(since: string | null, limit: number): Promise<SyncRow[]>;
  push(rows: SyncRow[]): Promise<void>;
  /** Live changes from other devices. Returns an unsubscribe function. */
  subscribe(onRow: (row: SyncRow) => void, onStatus?: (live: boolean) => void): () => void;

  uploadFile(key: string, blob: Blob): Promise<void>;
  downloadFile(key: string): Promise<Blob | null>;
  removeFiles(keys: string[]): Promise<void>;
  removeAllFiles(): Promise<void>;

  /** Push notifications (phone / computer), when the backend can send them. */
  notifications?: PushApi;
}

export class CloudError extends Error {
  constructor(
    message: string,
    public code:
      | 'invalid_credentials'
      | 'email_taken'
      | 'weak_password'
      | 'not_confirmed'
      | 'rate_limited'
      | 'network'
      | 'invalid_recovery_key'
      | 'session_expired'
      | 'unknown' = 'unknown',
  ) {
    super(message);
  }
}
