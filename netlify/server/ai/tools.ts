/* ──────────────────────────────────────────────────────────────
   KROOPY AI tools.

   Read tools run here, on the server, on the signed-in account's own
   data only (the account id comes from the verified token):
     search_kroopy · get_details · get_schedule · get_stats · remember

   Action tools have no `execute` here: the call goes to the app, which
   shows a confirmation card; only if the person accepts does the app
   create the records (exactly like creating them by hand — they then
   sync to every device). Nothing is ever created without that tap.
     save_ideas · create_tasks · add_events · create_video
   ────────────────────────────────────────────────────────────── */
import { tool } from 'ai';
import { z } from 'zod';
import type { DataState } from '../store';
import { getConversation, type ConvMeta } from './history';
import { addMemory, type Memory } from './memory';

type Rec = Record<string, unknown> & { id: string; title?: string; demo?: boolean; updatedAt?: number };
const KINDS = ['idea', 'video', 'task', 'event', 'goal', 'stat', 'memory', 'conversation'] as const;
type Kind = (typeof KINDS)[number];
const COLLECTION: Record<Exclude<Kind, 'memory' | 'conversation'>, string> = { idea: 'ideas', video: 'projects', task: 'tasks', event: 'events', goal: 'goals', stat: 'analytics' };

function rows(state: DataState | null, collection: string): Rec[] {
  if (!state) return [];
  const out: Rec[] = [];
  const prefix = `${collection}/`;
  for (const [k, r] of Object.entries(state.rows)) if (k.startsWith(prefix) && !r.x && r.d && typeof r.d === 'object' && !(r.d as Rec).demo) out.push(r.d as Rec);
  return out;
}
const str = (v: unknown, n = 400) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/* ── conventional search with forgiving matching ──
   Accents and case are ignored, plural/singular and word stems match ("vlogs" ~ "vlog",
   "tecnología" ~ "tecnológico"), and the model searches with several phrasings at once,
   so a memory is found even when it was worded differently. */
const STOP = new Set('de la el los las un una unos unas y o en con por para que se del al lo mi mis tu tus su sus es son sobre como mas pero sin ya the a an and or of to in on for with my your is are this that about what'.split(' '));
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ');
const tokens = (s: string) => norm(s).split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));
const stem = (t: string) => (t.length > 5 ? t.slice(0, Math.max(5, t.length - 3)) : t.replace(/(es|s)$/, ''));

function score(queryTokens: string[], title: string, body: string) {
  const tt = tokens(title).map(stem);
  const bt = tokens(body).map(stem);
  let s = 0;
  for (const q of queryTokens.map(stem)) {
    const hit = (list: string[]) => (list.includes(q) ? 1 : list.some((w) => w.length >= 4 && q.length >= 4 && (w.startsWith(q) || q.startsWith(w))) ? 0.7 : 0);
    s += Math.max(hit(tt) * 2, hit(bt));
  }
  return s;
}

interface Doc {
  kind: Kind;
  id: string;
  title: string;
  body: string;
  date?: string;
  extra?: string;
}

function corpus(state: DataState | null, memories: Memory[], convs: ConvMeta[]): Doc[] {
  const docs: Doc[] = [];
  const day = (t: unknown) => (typeof t === 'number' ? new Date(t).toISOString().slice(0, 10) : undefined);
  for (const i of rows(state, 'ideas')) docs.push({ kind: 'idea', id: i.id, title: str(i.title, 120), body: `${str(i.description, 600)} ${str(i.category)} ${(i.tags as string[] | undefined)?.join(' ') ?? ''}`, date: day(i.updatedAt), extra: String(i.status ?? '') });
  for (const p of rows(state, 'projects')) {
    const sc = (p.script ?? {}) as Record<string, unknown>;
    docs.push({ kind: 'video', id: p.id, title: str(p.title, 120), body: `${str(p.description, 400)} ${str(p.category)} ${str(sc.hook, 200)} ${str(sc.body, 400)}`, date: String(p.publishDate ?? day(p.updatedAt) ?? ''), extra: `stage ${p.stage}` });
  }
  for (const t of rows(state, 'tasks')) docs.push({ kind: 'task', id: t.id, title: str(t.title, 120), body: str(t.description, 300), date: String(t.dueDate ?? ''), extra: String(t.status ?? '') });
  for (const e of rows(state, 'events')) docs.push({ kind: 'event', id: e.id, title: str(e.title, 120), body: str(e.notes, 300), date: String(e.date ?? ''), extra: String(e.type ?? '') });
  for (const g of rows(state, 'goals')) docs.push({ kind: 'goal', id: g.id, title: str(g.title, 120), body: str(g.description, 300), date: String(g.dueDate ?? ''), extra: String(g.status ?? '') });
  for (const a of rows(state, 'analytics')) docs.push({ kind: 'stat', id: a.id, title: str(a.title, 120), body: `${str(a.category)} ${str(a.platformId)}`, date: String(a.publishedDate ?? ''), extra: `${a.views} views` });
  for (const m of memories) docs.push({ kind: 'memory', id: m.id, title: m.text, body: m.kind, date: day(m.created) });
  for (const c of convs) docs.push({ kind: 'conversation', id: c.id, title: c.title, body: c.digest ?? '', date: day(c.updated) });
  return docs;
}

export interface ToolEnv {
  uid: string;
  state: DataState | null;
  memories: Memory[];
  convs: ConvMeta[];
  today: string;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD');
const time = z.string().regex(/^\d{2}:\d{2}$/).describe('HH:MM, 24 h');

export function buildTools(env: ToolEnv) {
  const docs = () => corpus(env.state, env.memories, env.convs);
  return {
    search_kroopy: tool({
      description:
        "Search the person's own KROOPY workspace: ideas, videos (scripts), tasks, calendar events, goals, statistics they entered, things they asked you to remember, and past conversations with you. Use it whenever they refer to something from before (\"that idea about…\", \"what did we decide…\"). Pass 2–5 different phrasings or synonyms in `queries` (e.g. «vlog jornada», «rutina diaria», «día de trabajo») because their words may differ from what was saved.",
      inputSchema: z.object({
        queries: z.array(z.string().min(1).max(80)).min(1).max(5),
        kinds: z.array(z.enum(KINDS)).optional().describe('Limit to these kinds; omit to search everything'),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async ({ queries, kinds, limit }) => {
        const pool = docs().filter((d) => !kinds?.length || kinds.includes(d.kind));
        const scored = pool
          .map((d) => ({ d, s: Math.max(...queries.map((q) => score(tokens(q), d.title, d.body))) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s || String(b.d.date ?? '').localeCompare(String(a.d.date ?? '')))
          .slice(0, limit ?? 8);
        return {
          results: scored.map(({ d }) => ({ kind: d.kind, id: d.id, title: d.title, snippet: str(d.body, 220), date: d.date, info: d.extra })),
          note: scored.length ? undefined : 'Nothing matched. Try other words or synonyms, or tell the person it was not found.',
        };
      },
    }),

    get_details: tool({
      description: 'Full details of one item found with search_kroopy: an idea, a video with its script, a task, an event, a goal, or a past conversation (its messages).',
      inputSchema: z.object({ kind: z.enum(['idea', 'video', 'task', 'event', 'goal', 'conversation']), id: z.string().max(80) }),
      execute: async ({ kind, id }) => {
        if (kind === 'conversation') {
          const conv = await getConversation(env.uid, id).catch(() => null);
          if (!conv) return { error: 'Not found' };
          type M = { role: string; parts?: { type: string; text?: string }[] };
          const messages = (conv.messages as M[])
            .map((m) => ({ role: m.role, text: str((m.parts ?? []).map((p) => (p.type === 'text' ? p.text ?? '' : '')).join(' '), 1200) }))
            .filter((m) => m.text)
            .slice(-16);
          return { title: conv.title, date: new Date(conv.updated).toISOString().slice(0, 10), messages };
        }
        const r = rows(env.state, COLLECTION[kind]).find((x) => x.id === id);
        if (!r) return { error: 'Not found' };
        if (kind === 'goal') {
          const progress = rows(env.state, 'goalProgress').filter((p) => p.goalId === id);
          const total = progress.reduce((s, p) => s + Number(p.value ?? 0), 0);
          return { ...trim(r), progressLogged: total };
        }
        return trim(r);
      },
    }),

    get_schedule: tool({
      description: 'What is planned between two dates: calendar events, tasks due, and videos with recording, editing or publishing dates. Use it to organise their week or check availability. At most 62 days.',
      inputSchema: z.object({ from: date, to: date }),
      execute: async ({ from, to }) => {
        const inRange = (d: unknown) => typeof d === 'string' && d >= from && d <= to;
        return {
          from,
          to,
          today: env.today,
          events: rows(env.state, 'events').filter((e) => inRange(e.date)).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 80).map((e) => ({ date: e.date, start: e.startTime, end: e.endTime, title: str(e.title, 100), type: e.type })),
          tasksDue: rows(env.state, 'tasks').filter((t) => t.status !== 'done' && inRange(t.dueDate)).slice(0, 80).map((t) => ({ due: t.dueDate, time: t.dueTime, title: str(t.title, 100), priority: t.priority })),
          videos: rows(env.state, 'projects')
            .filter((p) => inRange(p.recordDate) || inRange(p.editDate) || inRange(p.publishDate))
            .slice(0, 60)
            .map((p) => ({ title: str(p.title, 100), stage: p.stage, record: p.recordDate, edit: p.editDate, publish: p.publishDate })),
        };
      },
    }),

    get_stats: tool({
      description:
        'Performance numbers the person entered in KROOPY (views, likes, comments, shares, saves, reach, followers gained), per platform, with best and worst posts, for a date range. These are manual entries, not live data from the platforms — say so when you use them, and always state the period analysed.',
      inputSchema: z.object({ from: date.optional(), to: date.optional(), platform: z.string().max(40).optional() }),
      execute: async ({ from, to, platform }) => {
        const settings = (env.state?.rows['_single/settings']?.d ?? {}) as { platforms?: { id: string; name: string }[] };
        const names = new Map((settings.platforms ?? []).map((p) => [p.id, p.name]));
        const list = rows(env.state, 'analytics').filter(
          (a) => (!from || String(a.publishedDate) >= from) && (!to || String(a.publishedDate) <= to) && (!platform || a.platformId === platform || names.get(String(a.platformId))?.toLowerCase() === platform.toLowerCase()),
        );
        const n = (v: unknown) => Number(v) || 0;
        const byPlatform: Record<string, { posts: number; views: number; likes: number; comments: number; shares: number; saves: number; reach: number; followersGained: number }> = {};
        for (const a of list) {
          const k = names.get(String(a.platformId)) ?? String(a.platformId);
          const b = (byPlatform[k] ??= { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, followersGained: 0 });
          b.posts++;
          b.views += n(a.views);
          b.likes += n(a.likes);
          b.comments += n(a.comments);
          b.shares += n(a.shares);
          b.saves += n(a.saves);
          b.reach += n(a.reach);
          b.followersGained += n(a.followersGained);
        }
        const brief = (a: Rec) => ({ date: a.publishedDate, title: str(a.title, 80), platform: names.get(String(a.platformId)) ?? a.platformId, format: a.format, category: a.category, views: n(a.views), likes: n(a.likes), comments: n(a.comments), shares: n(a.shares), saves: n(a.saves) });
        const byViews = [...list].sort((a, b) => n(b.views) - n(a.views));
        return {
          period: { from: from ?? 'all', to: to ?? 'all' },
          source: 'entered by hand in KROOPY (social accounts are not connected yet)',
          posts: list.length,
          byPlatform,
          best: byViews.slice(0, 5).map(brief),
          worst: byViews.slice(-5).reverse().map(brief),
        };
      },
    }),

    remember: tool({
      description:
        'Keep something in long-term memory: a preference, a decision, a goal or a fact about the person or their content ("this month we push workday vlogs", "prefers a close, personal tone"). Use it when they ask you to remember, or when they state a clear decision or preference. Never store passwords, health, money or other sensitive data. The person sees what you saved and can delete it.',
      inputSchema: z.object({ text: z.string().min(3).max(300), kind: z.enum(['preference', 'decision', 'fact', 'goal']) }),
      execute: async ({ text, kind }) => {
        const m = await addMemory(env.uid, text, kind);
        env.memories.unshift(m);
        return { saved: true, id: m.id };
      },
    }),

    /* ── actions: confirmed by the person in the app, then carried out there ── */
    save_ideas: tool({
      description: 'Propose saving one or more ideas to the person’s idea bank (My Ideas). They confirm in the app before anything is saved.',
      inputSchema: z.object({
        ideas: z.array(z.object({ title: z.string().min(1).max(140), description: z.string().max(4000).optional(), category: z.string().max(40).optional(), tags: z.array(z.string().max(30)).max(8).optional() })).min(1).max(10),
      }),
    }),
    create_tasks: tool({
      description: 'Propose creating one or more tasks (with optional due date/time and priority). They confirm in the app before anything is created.',
      inputSchema: z.object({
        tasks: z
          .array(z.object({ title: z.string().min(1).max(140), description: z.string().max(2000).optional(), dueDate: date.optional(), dueTime: time.optional(), priority: z.enum(['low', 'medium', 'high', 'urgent']).optional() }))
          .min(1)
          .max(15),
      }),
    }),
    add_events: tool({
      description: 'Propose adding one or more events to the calendar (recording, editing, meeting, personal, other). They confirm in the app first. Check get_schedule before placing things to avoid clashes.',
      inputSchema: z.object({
        events: z
          .array(z.object({ title: z.string().min(1).max(140), date, startTime: time.optional(), endTime: time.optional(), type: z.enum(['recording', 'editing', 'meeting', 'personal', 'other']).optional(), notes: z.string().max(1000).optional() }))
          .min(1)
          .max(15),
      }),
    }),
    create_video: tool({
      description: 'Propose creating a video project in Content Studio with its script (hook, body, call to action, caption). They confirm in the app first.',
      inputSchema: z.object({
        title: z.string().min(1).max(140),
        description: z.string().max(1000).optional(),
        hook: z.string().max(600).optional(),
        body: z.string().max(6000).optional(),
        cta: z.string().max(600).optional(),
        caption: z.string().max(2200).optional(),
        publishDate: date.optional(),
      }),
    }),
  };
}

export type KroopyTools = ReturnType<typeof buildTools>;
export const ACTION_TOOLS = ['save_ideas', 'create_tasks', 'add_events', 'create_video'] as const;

function trim(r: Rec) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (['createdAt', 'updatedAt', 'demo', 'order', 'assetIds', 'stageDates', 'production', 'editing', 'shots'].includes(k)) continue;
    if (typeof v === 'string') out[k] = str(v, 3000);
    else out[k] = v;
  }
  return out;
}
