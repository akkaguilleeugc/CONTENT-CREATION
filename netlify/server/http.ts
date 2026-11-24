/* Small HTTP helpers shared by the KROOPY cloud functions. */

export type ErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_email'
  | 'invalid_recovery_key'
  | 'rate_limited'
  | 'session_expired'
  | 'account_gone'
  | 'bad_request'
  | 'too_large'
  | 'not_found'
  | 'busy'
  | 'push_unavailable'
  | 'ai_unavailable'
  | 'unknown';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const NO_STORE = { 'cache-control': 'no-store' };

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE, ...(init.headers || {}) } });

export const fail = (e: unknown) => {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code }, { status: e.status });
  console.error('[kroopy-cloud]', e);
  return json({ error: 'Something went wrong on the server.', code: 'unknown' }, { status: 500 });
};

/** Parses a JSON body with a size cap (bytes). */
export async function body<T>(req: Request, max = 5_500_000): Promise<T> {
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, 'too_large', 'That is too much data for one request.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'bad_request', 'The request body is not valid JSON.');
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
