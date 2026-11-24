/* Accounts: email + password (scrypt), a recovery key for forgotten passwords, signed session tokens. */
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './http';
import { configStore, dataStore, getOrCreate, usersStore } from './store';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export interface Account {
  uid: string;
  email: string;
  salt: string;
  hash: string;
  rsalt?: string;
  rhash?: string;
  tv: number;
  created: number;
  fails?: number[];
}

export const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
export const emailKey = (email: string) => `e/${createHash('sha256').update(email).digest('hex')}`;
export const accountKey = (uid: string) => `u/${uid}`;

export function checkEmail(email: string) {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid_email', 'Enter a valid email.');
}
export function checkPassword(pw: unknown): asserts pw is string {
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpError(400, 'weak_password', 'Use at least 8 characters for your password.');
  if (pw.length > 256) throw new HttpError(400, 'weak_password', 'That password is too long.');
}

export async function hashSecret(secret: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(secret, salt, 64, SCRYPT);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}
export async function verifySecret(secret: string, salt: string | undefined, hash: string | undefined) {
  if (!salt || !hash) {
    await scrypt(secret, randomBytes(16), 64, SCRYPT); // same cost either way: no timing hint
    return false;
  }
  const got = await scrypt(secret, Buffer.from(salt, 'base64'), 64, SCRYPT);
  const want = Buffer.from(hash, 'base64');
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ── recovery keys: XXXXX-XXXXX-XXXXX-XXXXX, no look-alike characters ── */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRecoveryKey() {
  const bytes = randomBytes(20);
  let s = '';
  for (let i = 0; i < 20; i++) s += ALPHA[bytes[i]! % ALPHA.length];
  return s.match(/.{5}/g)!.join('-');
}
export const normRecoveryKey = (k: unknown) =>
  String(k ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/* ── session tokens: v1.<uid>.<tokenVersion>.<expires>.<hmac> ── */
const DAY = 86_400;
const LIFETIME = 365 * DAY;
const RENEW_BELOW = 180 * DAY;
let secretP: Promise<Buffer> | null = null;
function signingKey() {
  if (!secretP)
    secretP = getOrCreate(configStore(), 'secret', () => ({ key: randomBytes(32).toString('base64') }))
      .then((v) => Buffer.from((v as { key: string }).key, 'base64'))
      .catch((e) => {
        secretP = null;
        throw e;
      });
  return secretP;
}
const b64url = (b: Buffer) => b.toString('base64url');

export async function issueToken(uid: string, tv: number) {
  const exp = Math.floor(Date.now() / 1000) + LIFETIME;
  const payload = `v1.${uid}.${tv}.${exp}`;
  return `${payload}.${b64url(createHmac('sha256', await signingKey()).update(payload).digest())}`;
}

export interface Session {
  uid: string;
  tv: number;
  /** last change time of the person's data (ms), from the data blob's metadata */
  t: number;
  /** a fresh token when the current one is getting old */
  renewed?: string;
}

/** Verifies the bearer token and that the account still exists with the same token version. */
export async function authenticate(req: Request): Promise<Session> {
  const raw = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = raw.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') throw new HttpError(401, 'session_expired', 'Sign in again.');
  const [, uid, tvS, expS, sig] = parts as [string, string, string, string, string];
  const want = createHmac('sha256', await signingKey()).update(`v1.${uid}.${tvS}.${expS}`).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'session_expired', 'Sign in again.');
  const exp = Number(expS);
  const now = Math.floor(Date.now() / 1000);
  if (!(exp > now)) throw new HttpError(401, 'session_expired', 'Your session ended. Sign in again.');
  const meta = await dataStore().getMetadata(uid);
  if (!meta) throw new HttpError(401, 'account_gone', 'This account no longer exists.');
  const tv = Number(meta.metadata.tv ?? 1);
  if (tv !== Number(tvS)) throw new HttpError(401, 'session_expired', 'Your password changed. Sign in again.');
  const session: Session = { uid, tv, t: Number(meta.metadata.t ?? 0) };
  if (exp - now < RENEW_BELOW) session.renewed = await issueToken(uid, tv);
  return session;
}

export const newUid = () => randomUUID();

/* ── brute-force protection ── */
const WINDOW = 15 * 60_000;
const MAX_FAILS = 10;
export const recentFails = (a: Account) => (a.fails || []).filter((t) => Date.now() - t < WINDOW);
export function assertNotLocked(a: Account) {
  if (recentFails(a).length >= MAX_FAILS) throw new HttpError(429, 'rate_limited', 'Too many attempts. Wait 15 minutes and try again.');
}
export async function recordFail(a: Account) {
  a.fails = [...recentFails(a), Date.now()].slice(-MAX_FAILS);
  await usersStore().setJSON(accountKey(a.uid), a);
}

/** Per-instance limiter for auth endpoints (best effort; each account also has its own lockout). */
const hits = new Map<string, number[]>();
export function limitIp(ip: string | undefined, max = 40, windowMs = 10 * 60_000) {
  if (!ip) return;
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  if (list.length > max) throw new HttpError(429, 'rate_limited', 'Too many attempts. Wait a few minutes and try again.');
}
