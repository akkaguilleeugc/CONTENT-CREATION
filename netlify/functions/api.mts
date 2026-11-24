/* ──────────────────────────────────────────────────────────────
   KROOPY cloud API — accounts, sync between devices, files and
   phone notifications. Runs on the same site as the app, so it needs
   no keys, no extra accounts and no configuration.

   GET  /api/health
   POST /api/auth/signup | signin | reset        → { token, user, recoveryKey? }
   POST /api/auth/password | recovery            (signed in)
   GET  /api/sync?since=<iso>&limit=<n>           changes after `since`
   POST /api/sync                                 [rows]
   PUT  /api/files/<key>?part=<i>&parts=<n>       a part of a file
   GET  /api/files/<key>?part=<i>
   POST /api/files/remove                         [keys]
   DELETE /api/account
   GET  /api/push/key · POST /api/push/subscribe | unsubscribe | test · PUT /api/push/schedule
   ────────────────────────────────────────────────────────────── */
import type { Config, Context } from '@netlify/functions';
import {
  type Account,
  accountKey,
  assertNotLocked,
  authenticate,
  checkEmail,
  checkPassword,
  emailKey,
  hashSecret,
  issueToken,
  limitIp,
  newRecoveryKey,
  newUid,
  normEmail,
  normRecoveryKey,
  recordFail,
  verifySecret,
  type Session,
} from '../server/auth';
import { HttpError, body, fail, json } from '../server/http';
import { LATE, type PushItem, type PushSub, sendAll, subjectFor, updatePush, vapid } from '../server/push';
import { createState, dataStore, deletePrefix, emptyState, filesStore, pushStore, readState, updateState, usersStore } from '../server/store';

const PART_MAX = 4_000_000; // bytes per file part (function payloads are capped at 6 MB, base64 adds a third)

interface SyncRowIn {
  collection: string;
  id: string;
  data: unknown;
  deleted: boolean;
  device?: string | null;
}

const userOut = (a: Account) => ({ id: a.uid, email: a.email });

async function findAccount(email: string): Promise<Account | null> {
  const idx = (await usersStore().get(emailKey(email), { type: 'json' })) as { uid: string } | null;
  if (!idx) return null;
  return (await usersStore().get(accountKey(idx.uid), { type: 'json' })) as Account | null;
}

/* ── auth ── */
async function signup(req: Request, ctx: Context) {
  limitIp(ctx.ip, 20);
  const { email: rawEmail, password } = await body<{ email?: string; password?: string }>(req, 10_000);
  const email = normEmail(rawEmail);
  checkEmail(email);
  checkPassword(password);
  const users = usersStore();
  const uid = newUid();
  const { modified } = await users.setJSON(emailKey(email), { uid }, { onlyIfNew: true });
  if (!modified) {
    // Taken — unless an earlier sign-up died half-way and left only the index behind.
    const existing = await findAccount(email);
    if (existing) throw new HttpError(409, 'email_taken', 'There is already an account with this email.');
    await users.setJSON(emailKey(email), { uid });
  }
  const recoveryKey = newRecoveryKey();
  const [pw, rk] = await Promise.all([hashSecret(password), hashSecret(normRecoveryKey(recoveryKey))]);
  const account: Account = { uid, email, salt: pw.salt, hash: pw.hash, rsalt: rk.salt, rhash: rk.hash, tv: 1, created: Date.now() };
  await users.setJSON(accountKey(uid), account);
  await createState(uid, emptyState(1));
  return json({ token: await issueToken(uid, 1), user: userOut(account), recoveryKey }, { status: 201 });
}

async function signin(req: Request, ctx: Context) {
  limitIp(ctx.ip);
  const { email: rawEmail, password } = await body<{ email?: string; password?: string }>(req, 10_000);
  const email = normEmail(rawEmail);
  const account = email ? await findAccount(email) : null;
  if (account) assertNotLocked(account);
  const ok = await verifySecret(String(password ?? ''), account?.salt, account?.hash);
  if (!account || !ok) {
    if (account) await recordFail(account);
    throw new HttpError(401, 'invalid_credentials', 'Wrong email or password.');
  }
  if (account.fails?.length) {
    account.fails = [];
    await usersStore().setJSON(accountKey(account.uid), account);
  }
  const meta = await dataStore().getMetadata(account.uid);
  if (!meta) await createState(account.uid, emptyState(account.tv));
  return json({ token: await issueToken(account.uid, account.tv), user: userOut(account) });
}

/** Forgotten password: email + recovery key + new password. */
async function reset(req: Request, ctx: Context) {
  limitIp(ctx.ip, 20);
  const { email: rawEmail, recoveryKey, password } = await body<{ email?: string; recoveryKey?: string; password?: string }>(req, 10_000);
  const email = normEmail(rawEmail);
  checkPassword(password);
  const account = email ? await findAccount(email) : null;
  if (account) assertNotLocked(account);
  const ok = await verifySecret(normRecoveryKey(recoveryKey), account?.rsalt, account?.rhash);
  if (!account || !ok) {
    if (account) await recordFail(account);
    throw new HttpError(401, 'invalid_recovery_key', 'That email and recovery key don’t match.');
  }
  return json({ ...(await setPassword(account, password)), user: userOut(account) });
}

/** New password: every other device is signed out (the token version changes). */
async function setPassword(account: Account, password: string) {
  const pw = await hashSecret(password);
  const tv = await updateState(account.uid, (s) => (s.tv += 1));
  Object.assign(account, { salt: pw.salt, hash: pw.hash, tv, fails: [] });
  await usersStore().setJSON(accountKey(account.uid), account);
  return { token: await issueToken(account.uid, tv) };
}

async function loadAccount(uid: string) {
  const a = (await usersStore().get(accountKey(uid), { type: 'json' })) as Account | null;
  if (!a) throw new HttpError(401, 'account_gone', 'This account no longer exists.');
  return a;
}

async function changePassword(req: Request, s: Session) {
  const { password } = await body<{ password?: string }>(req, 10_000);
  checkPassword(password);
  return json(await setPassword(await loadAccount(s.uid), password));
}

async function rotateRecovery(s: Session) {
  const account = await loadAccount(s.uid);
  const recoveryKey = newRecoveryKey();
  const rk = await hashSecret(normRecoveryKey(recoveryKey));
  Object.assign(account, { rsalt: rk.salt, rhash: rk.hash });
  await usersStore().setJSON(accountKey(account.uid), account);
  return json({ recoveryKey });
}

/* ── sync ── */
async function pull(url: URL, s: Session) {
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw ? Date.parse(sinceRaw) : 0;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 1000, 1), 5000);
  if (since && s.t <= since) return json([]); // nothing new: answered from metadata alone
  const cur = await readState(s.uid);
  if (!cur) throw new HttpError(401, 'account_gone', 'This account no longer exists.');
  const rows = Object.entries(cur.state.rows)
    .filter(([, r]) => r.t > (since || 0))
    .sort((a, b) => a[1].t - b[1].t)
    .slice(0, limit)
    .map(([k, r]) => {
      const cut = k.indexOf('/');
      return { collection: k.slice(0, cut), id: k.slice(cut + 1), data: r.x ? null : r.d, deleted: !!r.x, device: r.dev ?? null, updated_at: new Date(r.t).toISOString() };
    });
  return json(rows);
}

const COLLECTION = /^[_A-Za-z][A-Za-z0-9_]{0,39}$/;
async function push(req: Request, s: Session) {
  const rows = await body<SyncRowIn[]>(req);
  if (!Array.isArray(rows) || rows.length > 5000) throw new HttpError(400, 'bad_request', 'Send an array of up to 5000 rows.');
  for (const r of rows)
    if (!r || typeof r.collection !== 'string' || !COLLECTION.test(r.collection) || typeof r.id !== 'string' || !r.id || r.id.length > 200)
      throw new HttpError(400, 'bad_request', 'A row is missing its collection or id.');
  const clock = await updateState(s.uid, (st) => {
    for (const r of rows) {
      st.clock = Math.max(Date.now(), st.clock + 1); // a distinct, increasing time for every row
      st.rows[`${r.collection}/${r.id}`] = r.deleted ? { d: null, x: 1, dev: r.device ?? null, t: st.clock } : { d: r.data ?? null, dev: r.device ?? null, t: st.clock };
    }
    return st.clock;
  });
  return json({ ok: true, at: new Date(clock).toISOString() });
}

/* ── files ── */
const fileKey = (k: string) => {
  if (!k || k.length > 200 || /[/\\]/.test(k)) throw new HttpError(400, 'bad_request', 'Invalid file key.');
  return k;
};
const partKey = (uid: string, key: string, part: number) => `${uid}/${key}/${String(part).padStart(4, '0')}`;

async function putFile(req: Request, url: URL, key: string, s: Session) {
  const part = Number(url.searchParams.get('part') || 0);
  const parts = Number(url.searchParams.get('parts') || 1);
  if (!Number.isInteger(part) || !Number.isInteger(parts) || part < 0 || parts < 1 || part >= parts || parts > 2000) throw new HttpError(400, 'bad_request', 'Invalid file part.');
  const buf = await req.arrayBuffer();
  if (buf.byteLength > PART_MAX + 1024) throw new HttpError(413, 'too_large', 'File part too large.');
  if (part === 0) await deletePrefix(filesStore(), `${s.uid}/${key}/`); // replacing an older upload
  await filesStore().set(partKey(s.uid, key, part), buf, { metadata: { parts, type: req.headers.get('content-type') || 'application/octet-stream' } });
  return json({ ok: true });
}

async function getFile(url: URL, key: string, s: Session) {
  const part = Number(url.searchParams.get('part') || 0);
  const hit = await filesStore().getWithMetadata(partKey(s.uid, key, Number.isInteger(part) ? part : 0), { type: 'arrayBuffer' });
  if (!hit || !hit.data) return json({ error: 'Not found', code: 'not_found' }, { status: 404 });
  return new Response(hit.data, {
    headers: { 'content-type': String(hit.metadata.type || 'application/octet-stream'), 'x-parts': String(hit.metadata.parts || 1), 'cache-control': 'private, no-store' },
  });
}

async function removeFiles(req: Request, s: Session) {
  const keys = await body<string[]>(req, 200_000);
  if (!Array.isArray(keys)) throw new HttpError(400, 'bad_request', 'Send an array of keys.');
  for (const k of keys.slice(0, 500)) await deletePrefix(filesStore(), `${s.uid}/${fileKey(String(k))}/`);
  return json({ ok: true });
}

/* ── account ── */
async function deleteAccount(s: Session) {
  const account = await loadAccount(s.uid);
  await deletePrefix(filesStore(), `${s.uid}/`);
  await pushStore().delete(s.uid);
  await dataStore().delete(s.uid);
  await usersStore().delete(emailKey(account.email));
  await usersStore().delete(accountKey(s.uid));
  return json({ ok: true });
}

/* ── push notifications ── */
async function subscribe(req: Request, s: Session) {
  const { subscription, device } = await body<{ subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; device?: string }>(req, 20_000);
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;
  if (!endpoint || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) throw new HttpError(400, 'bad_request', 'Invalid push subscription.');
  const sub: PushSub = { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, device: device ? String(device).slice(0, 64) : undefined, created: Date.now() };
  const count = await updatePush(s.uid, (r) => {
    r.subs = [...r.subs.filter((x) => x.endpoint !== endpoint && (!sub.device || x.device !== sub.device)), sub].slice(-10);
    return r.subs.length;
  });
  return json({ ok: true, devices: count });
}

async function unsubscribe(req: Request, s: Session) {
  const { endpoint, device } = await body<{ endpoint?: string; device?: string }>(req, 20_000);
  await updatePush(s.uid, (r) => {
    r.subs = r.subs.filter((x) => x.endpoint !== endpoint && (!device || x.device !== device));
  });
  return json({ ok: true });
}

async function schedule(req: Request, s: Session) {
  const { items } = await body<{ items?: PushItem[] }>(req, 400_000);
  if (!Array.isArray(items)) throw new HttpError(400, 'bad_request', 'Send { items: [...] }.');
  const now = Date.now();
  const clean = items
    .filter((i) => i && typeof i.key === 'string' && typeof i.at === 'number' && i.at > now - LATE && i.at < now + 15 * 86_400_000)
    .slice(0, 400)
    .map((i) => ({ key: i.key.slice(0, 200), at: i.at, title: String(i.title || 'KROOPY').slice(0, 140), body: String(i.body || '').slice(0, 300), url: String(i.url || '/').slice(0, 200) }));
  const out = await updatePush(s.uid, (r) => {
    r.items = clean;
    for (const [k, at] of Object.entries(r.sent)) if (now - at > 3 * 86_400_000) delete r.sent[k];
    return { devices: r.subs.length, upcoming: clean.filter((i) => !r.sent[i.key]).length };
  });
  return json({ ok: true, ...out });
}

async function testPush(req: Request, s: Session, ctx: Context) {
  const { device, title, body: text } = await body<{ device?: string; title?: string; body?: string }>(req, 20_000);
  const rec = await pushStore().get(s.uid, { type: 'json' });
  const subs = ((rec?.subs || []) as PushSub[]).filter((x) => !device || x.device === device);
  if (!subs.length) throw new HttpError(404, 'not_found', 'Turn on notifications on this device first.');
  const res = await sendAll(subs, { title: String(title || 'KROOPY').slice(0, 140), body: String(text || '').slice(0, 300), url: '/settings', tag: `test-${Date.now()}` }, subjectFor(ctx.site?.url));
  if (res.gone.length) await updatePush(s.uid, (r) => void (r.subs = r.subs.filter((x) => !res.gone.includes(x.endpoint))));
  return json({ ok: res.ok > 0, sent: res.ok, failed: res.failed + res.gone.length });
}

/* ── router ── */
export default async (req: Request, ctx: Context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const m = req.method;
  try {
    if (path === '/health') return json({ ok: true, v: 1, push: true });
    if (path === '/push/key' && m === 'GET') return json({ publicKey: (await vapid()).publicKey });
    if (path === '/auth/signup' && m === 'POST') return await signup(req, ctx);
    if (path === '/auth/signin' && m === 'POST') return await signin(req, ctx);
    if (path === '/auth/reset' && m === 'POST') return await reset(req, ctx);

    const s = await authenticate(req);
    let res: Response | null = null;
    if (path === '/sync' && m === 'GET') res = await pull(url, s);
    else if (path === '/sync' && m === 'POST') res = await push(req, s);
    else if (path === '/auth/password' && m === 'POST') res = await changePassword(req, s);
    else if (path === '/auth/recovery' && m === 'POST') res = await rotateRecovery(s);
    else if (path === '/files/remove' && m === 'POST') res = await removeFiles(req, s);
    else if (path.startsWith('/files/') && (m === 'PUT' || m === 'GET')) {
      const key = fileKey(decodeURIComponent(path.slice('/files/'.length)));
      res = m === 'PUT' ? await putFile(req, url, key, s) : await getFile(url, key, s);
    } else if (path === '/account' && m === 'DELETE') res = await deleteAccount(s);
    else if (path === '/push/subscribe' && m === 'POST') res = await subscribe(req, s);
    else if (path === '/push/unsubscribe' && m === 'POST') res = await unsubscribe(req, s);
    else if (path === '/push/schedule' && m === 'PUT') res = await schedule(req, s);
    else if (path === '/push/test' && m === 'POST') res = await testPush(req, s, ctx);
    if (!res) return json({ error: 'Not found', code: 'not_found' }, { status: 404 });
    if (s.renewed) res.headers.set('x-kroopy-token', s.renewed);
    return res;
  } catch (e) {
    return fail(e);
  }
};

export const config: Config = { path: '/api/*' };
