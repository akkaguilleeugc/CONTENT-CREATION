/* KROOPY AI storage, per account (store `kroopy-ai`, keys always start with the account id):
   <uid>/conv/<id>      one conversation: { id, title, created, updated, messages }
   <uid>/index          the list of conversations (newest first)
   <uid>/usage/<YYYY-MM> spend per day: tokens, estimated USD, messages, models */
import { HttpError } from '../http';
import { aiStore, updateJSON } from '../store';
import { logActivity, type Activity } from './memory';

export interface ConvMeta {
  id: string;
  title: string;
  created: number;
  updated: number;
  /** a few lines of the conversation, for search */
  digest?: string;
}
export interface Conversation extends ConvMeta {
  messages: unknown[];
  /** tool calls already written to the activity log */
  logged?: string[];
}
type Part = { type: string; text?: string; toolCallId?: string; state?: string; input?: Record<string, unknown>; output?: Record<string, unknown>; errorText?: string };
type Msg = { role: string; parts?: Part[] };
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
  const logged = new Set(prev?.logged ?? []);
  const activity = newActivity(messages as Msg[], logged);
  const conv: Conversation = {
    id,
    title: prev?.title || titleFrom(titleHint),
    created: prev?.created ?? now,
    updated: now,
    digest: digestOf(messages as Msg[]),
    messages: messages.slice(-MAX_MESSAGES),
    logged: [...logged].slice(-500),
  };
  await aiStore().setJSON(`${uid}/conv/${id}`, conv);
  await updateJSON<ConvMeta[], void>(aiStore(), `${uid}/index`, () => [], (list) => {
    const rest = list.filter((c) => c.id !== id);
    list.splice(0, list.length, { id, title: conv.title, created: conv.created, updated: now, digest: conv.digest }, ...rest.slice(0, 499));
  });
  await logActivity(uid, activity);
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

const textOf = (m: Msg | undefined) => (m?.parts ?? []).map((p) => (p.type === 'text' ? p.text ?? '' : '')).join(' ').replace(/\s+/g, ' ').trim();

/** The person's first messages and the latest answer, short — enough to find the conversation again. */
function digestOf(messages: Msg[]) {
  const mine = messages.filter((m) => m.role === 'user').slice(0, 4).map(textOf).join(' · ');
  const last = textOf([...messages].reverse().find((m) => m.role === 'assistant'));
  return `${mine.slice(0, 500)} — ${last.slice(0, 400)}`;
}

/** Tool calls that finished since the last save, as activity entries (each logged once). */
function newActivity(messages: Msg[], logged: Set<string>): Activity[] {
  const out: Activity[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    for (const p of m.parts ?? []) {
      if (!p.type.startsWith('tool-') || !p.toolCallId || logged.has(p.toolCallId)) continue;
      if (p.state !== 'output-available' && p.state !== 'output-error') continue;
      logged.add(p.toolCallId);
      const tool = p.type.slice(5);
      const cancelled = p.state === 'output-error' || !!p.output?.cancelled;
      out.push({ at: Date.now(), tool, summary: summarize(tool, p.input ?? {}), status: p.state === 'output-error' ? 'error' : cancelled ? 'cancelled' : 'done' });
    }
  }
  return out;
}

function summarize(tool: string, input: Record<string, unknown>) {
  const titles = (list: unknown) => (Array.isArray(list) ? list.map((x) => String((x as { title?: string }).title ?? '')).filter(Boolean).slice(0, 5).join(', ') : '');
  switch (tool) {
    case 'save_ideas':
      return titles(input.ideas);
    case 'create_tasks':
      return titles(input.tasks);
    case 'add_events':
      return titles(input.events);
    case 'create_video':
      return String(input.title ?? '');
    case 'remember':
      return String(input.text ?? '');
    case 'search_kroopy':
      return Array.isArray(input.queries) ? input.queries.join(' / ') : '';
    default:
      return tool.replace(/_/g, ' ');
  }
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
