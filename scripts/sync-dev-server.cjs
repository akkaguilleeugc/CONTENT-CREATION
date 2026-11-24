/* KROOPY sync dev server — the same contract as the Supabase backend, in one file, for local
   development and the automated two-device tests. Not for production.

     node scripts/sync-dev-server.cjs [port]
     VITE_SYNC_DEV_URL=http://127.0.0.1:8787 npm run dev
*/
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const users = new Map(); // email → { id, email, password }
const tokens = new Map(); // token → user id
const rows = new Map(); // `${uid}|${collection}|${id}` → row
const files = new Map(); // `${uid}|${key}` → { type, buf }
const streams = new Map(); // uid → Set<res>

let lastTs = 0;
/** Strictly increasing server timestamps with microsecond precision (like clock_timestamp()). */
function now() {
  let t = Date.now() * 1000;
  if (t <= lastTs) t = lastTs + 1;
  lastTs = t;
  const ms = Math.floor(t / 1000), us = t % 1000;
  return new Date(ms).toISOString().replace('Z', String(us).padStart(3, '0') + '+00:00');
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
const json = (res, status, body) => {
  res.writeHead(status, { ...cors, 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const body = (req) => new Promise((resolve) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); });
const auth = (req, url) => {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  return tokens.get(tok) || null;
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return res.writeHead(204, cors), res.end();
  try {
    if (req.method === 'POST' && url.pathname === '/auth/signup') {
      const { email, password } = JSON.parse(await body(req));
      if (!email || !password) return json(res, 400, { error: 'Missing email or password', code: 'unknown' });
      if (users.has(email)) return json(res, 400, { error: 'Email already registered', code: 'email_taken' });
      if (password.length < 6) return json(res, 400, { error: 'Password should be at least 6 characters', code: 'weak_password' });
      const u = { id: crypto.randomUUID(), email, password };
      users.set(email, u);
      const token = crypto.randomBytes(16).toString('hex');
      tokens.set(token, u.id);
      return json(res, 200, { token, user: { id: u.id, email } });
    }
    if (req.method === 'POST' && url.pathname === '/auth/signin') {
      const { email, password } = JSON.parse(await body(req));
      const u = users.get(email);
      if (!u || u.password !== password) return json(res, 400, { error: 'Invalid login credentials', code: 'invalid_credentials' });
      const token = crypto.randomBytes(16).toString('hex');
      tokens.set(token, u.id);
      return json(res, 200, { token, user: { id: u.id, email } });
    }
    const uid = auth(req, url);
    if (!uid) return json(res, 401, { error: 'Not signed in', code: 'invalid_credentials' });

    if (req.method === 'GET' && url.pathname === '/pull') {
      const since = url.searchParams.get('since');
      const limit = Number(url.searchParams.get('limit') || 1000);
      const sinceKey = since ? Date.parse(since) * 1000 + (Number((since.match(/\.\d{3}(\d{3})/) || [])[1]) || 0) : -1;
      const list = [...rows.values()].filter((r) => r.user_id === uid && r._t > sinceKey).sort((a, b) => a._t - b._t).slice(0, limit);
      return json(res, 200, list.map(({ _t, user_id, ...r }) => r));
    }
    if (req.method === 'POST' && url.pathname === '/push') {
      const incoming = JSON.parse(await body(req));
      for (const r of incoming) {
        const ts = now();
        const t = lastTs;
        const row = { user_id: uid, collection: r.collection, id: r.id, data: r.deleted ? null : r.data, deleted: !!r.deleted, device: r.device || null, updated_at: ts, _t: t };
        rows.set(`${uid}|${r.collection}|${r.id}`, row);
        const { _t, user_id, ...out } = row;
        for (const s of streams.get(uid) || []) s.write(`data: ${JSON.stringify(out)}\n\n`);
      }
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      if (!streams.has(uid)) streams.set(uid, new Set());
      streams.get(uid).add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => { clearInterval(ping); streams.get(uid).delete(res); });
      return;
    }
    if (url.pathname.startsWith('/files/')) {
      const key = decodeURIComponent(url.pathname.slice(7));
      if (req.method === 'PUT') { files.set(`${uid}|${key}`, { type: req.headers['content-type'] || 'application/octet-stream', buf: await body(req) }); return json(res, 200, { ok: true }); }
      if (req.method === 'GET') { const f = files.get(`${uid}|${key}`); if (!f) return json(res, 404, { error: 'not found' }); res.writeHead(200, { ...cors, 'content-type': f.type }); return res.end(f.buf); }
    }
    if (req.method === 'POST' && url.pathname === '/files/remove') { for (const k of JSON.parse(await body(req))) files.delete(`${uid}|${k}`); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/auth/password') {
      const { password } = JSON.parse(await body(req));
      for (const u of users.values()) if (u.id === uid) u.password = password;
      return json(res, 200, { ok: true });
    }
    if (req.method === 'DELETE' && url.pathname === '/account') {
      for (const [k, r] of rows) if (r.user_id === uid) rows.delete(k);
      for (const k of files.keys()) if (k.startsWith(uid + '|')) files.delete(k);
      for (const [e, u] of users) if (u.id === uid) users.delete(e);
      for (const [t, id] of tokens) if (id === uid) tokens.delete(t);
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: String(e && e.message || e) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`KROOPY sync dev server on http://127.0.0.1:${PORT}`));
