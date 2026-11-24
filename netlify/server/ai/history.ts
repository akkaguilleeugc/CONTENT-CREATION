/* KROOPY AI storage, per account (store `kroopy-ai`, keys always start with the account id):
   <uid>/conv/<id>      one conversation: { id, title, created, updated, messages }
   <uid>/index          the list of conversations (newest first)
   <uid>/usage/<YYYY-MM> spend per day: tokens, estimated USD, messages, models */
import { HttpError } from '../http';
import { aiStore, updateJSON } from '../store';

export interface ConvMeta {
  id: string;
  title: string;
  created: number;
  updated: number;
}
export interface Conversation extends ConvMeta {
  messages: unknown[];
}
interface Usage {
  days: Record<string, { usd: number; input: number; output: number; messages: number }>;
  usd: number;
  models: Record<string, number>;
}

const MAX_MESSAGES = 300;
const ID = /^[A-Za-z0-9_-]{6,64}$/;
export const checkId = (id: unknown) => {
  if (typeof id !== 'string' || !ID.test(id)) throw new HttpError(400, 'bad_request', 'Invalid conversation id.');
  return id;
};

export async function listConversations(uid: string): Promise<ConvMeta[]> {
  return ((await aiStore().get(`${uid}/index`, { type: 'json' })) as ConvMeta[] | null) ?? [];
}

export async function getConversation(uid: string, id: string): Promise<Conversation | null> {
  return (await aiStore().get(`${uid}/conv/${checkId(id)}`, { type: 'json' })) as Conversation | null;
}

export async function saveConversation(uid: string, id: string, messages: unknown[], titleHint: string) {
  const prev = await getConversation(uid, id);
  const now = Date.now();
  const conv: Conversation = {
    id,
    title: prev?.title || titleFrom(titleHint),
    created: prev?.created ?? now,
    updated: now,
    messages: messages.slice(-MAX_MESSAGES),
  };
  await aiStore().setJSON(`${uid}/conv/${id}`, conv);
  await updateJSON<ConvMeta[], void>(aiStore(), `${uid}/index`, () => [], (list) => {
    const rest = list.filter((c) => c.id !== id);
    list.splice(0, list.length, { id, title: conv.title, created: conv.created, updated: now }, ...rest.slice(0, 499));
  });
}

export async function renameConversation(uid: string, id: string, title: string) {
  const conv = await getConversation(uid, id);
  if (!conv) throw new HttpError(404, 'not_found', 'Conversation not found.');
  conv.title = titleFrom(title);
  await aiStore().setJSON(`${uid}/conv/${id}`, conv);
  await updateJSON<ConvMeta[], void>(aiStore(), `${uid}/index`, () => [], (list) => {
    for (const c of list) if (c.id === id) c.title = conv.title;
  });
}

export async function deleteConversation(uid: string, id: string) {
  await aiStore().delete(`${uid}/conv/${checkId(id)}`);
  await updateJSON<ConvMeta[], void>(aiStore(), `${uid}/index`, () => [], (list) => {
    const keep = list.filter((c) => c.id !== id);
    list.splice(0, list.length, ...keep);
  });
}

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, ' ').trim();
  return (t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t) || 'New conversation';
}

/* ── spend ── */
const month = (d = new Date()) => d.toISOString().slice(0, 7);
const day = (d = new Date()) => d.toISOString().slice(8, 10);

export async function usageNow(uid: string) {
  const u = (await aiStore().get(`${uid}/usage/${month()}`, { type: 'json' })) as Usage | null;
  return { month: u?.usd ?? 0, today: u?.days[day()]?.usd ?? 0, messagesToday: u?.days[day()]?.messages ?? 0 };
}

export async function recordUsage(uid: string, model: string, input: number, output: number, usd: number) {
  await updateJSON<Usage, void>(aiStore(), `${uid}/usage/${month()}`, () => ({ days: {}, usd: 0, models: {} }), (u) => {
    const d = (u.days[day()] ??= { usd: 0, input: 0, output: 0, messages: 0 });
    d.usd += usd;
    d.input += input;
    d.output += output;
    d.messages += 1;
    u.usd += usd;
    u.models[model] = (u.models[model] ?? 0) + 1;
  });
}

/** Per-account limits (USD, estimated). The provider's own hard limit is the final stop. */
export const limits = () => ({
  daily: Number(Netlify.env.get('KROOPY_AI_DAILY_USD') || 0.5),
  monthly: Number(Netlify.env.get('KROOPY_AI_MONTHLY_USD') || 6),
});
