/* The cloud contract the sync engine talks to. Production: Supabase (./supabase.ts).
   Tests and local development can plug in another implementation (./devserver.ts). */

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

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION';

export interface CloudBackend {
  readonly kind: 'supabase' | 'dev';
  currentUser(): Promise<CloudUser | null>;
  onAuthChange(cb: (event: AuthEvent, user: CloudUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<{ user: CloudUser | null; needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<CloudUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
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
}

export class CloudError extends Error {
  constructor(
    message: string,
    public code: 'invalid_credentials' | 'email_taken' | 'weak_password' | 'not_confirmed' | 'rate_limited' | 'network' | 'unknown' = 'unknown',
  ) {
    super(message);
  }
}
