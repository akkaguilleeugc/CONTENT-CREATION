/* What KROOPY AI knows about the person's work: a compact, read-only summary of their own synced data
   (ideas, videos in production, calendar, tasks, goals, published stats). Built on the server from the
   account's storage — never from the browser — so it can only ever be the caller's own data. */
import type { DataState } from '../store';

type Rec = Record<string, unknown> & { id: string; title?: string; updatedAt?: number; demo?: boolean };

const clip = (v: unknown, n = 90) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

function rows(state: DataState, collection: string): Rec[] {
  const out: Rec[] = [];
  const prefix = `${collection}/`;
  for (const [k, r] of Object.entries(state.rows)) if (k.startsWith(prefix) && !r.x && r.d && typeof r.d === 'object' && !(r.d as Rec).demo) out.push(r.d as Rec); // sample data is not theirs
  return out;
}
const recent = (list: Rec[], n: number) => [...list].sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0)).slice(0, n);

/** A plain-text snapshot (≈ 600–1500 tokens), dated, for the system instructions. */
export function workspaceSnapshot(state: DataState | null, today: string): string {
  if (!state) return 'No synced data yet.';
  const settings = (state.rows['_single/settings']?.d ?? {}) as { profile?: { name?: string; handle?: string; role?: string }; platforms?: { id: string; name: string }[] };
  const platform = new Map((settings.platforms ?? []).map((p) => [p.id, p.name]));
  const plats = (ids: unknown) => (Array.isArray(ids) ? ids.map((i) => platform.get(String(i)) ?? i).join('/') : '');
  const lines: string[] = [];
  const p = settings.profile ?? {};
  lines.push(`Creator: ${clip(p.name || 'unknown', 40)}${p.handle ? ` (${clip(p.handle, 30)})` : ''}${p.role ? ` — ${clip(p.role, 40)}` : ''}. Platforms: ${(settings.platforms ?? []).map((x) => x.name).join(', ') || 'not set'}. Today: ${today}.`);

  const ideas = rows(state, 'ideas').filter((i) => i.status !== 'archived');
  if (ideas.length) {
    lines.push(`\nIdeas (${ideas.length} total; latest first):`);
    for (const i of recent(ideas, 15)) lines.push(`- ${clip(i.title, 70)}${i.category ? ` [${clip(i.category, 20)}]` : ''}${i.status ? ` · ${i.status}` : ''}${i.favorite ? ' ★' : ''}`);
  }

  const projects = rows(state, 'projects');
  const active = projects.filter((x) => x.stage !== 'published');
  if (active.length) {
    lines.push(`\nVideos in production (${active.length}):`);
    for (const x of recent(active, 10)) lines.push(`- ${clip(x.title, 70)} · stage ${x.stage}${x.publishDate ? ` · publish ${x.publishDate}` : ''}${plats(x.platformIds) ? ` · ${plats(x.platformIds)}` : ''}`);
  }
  const published = projects.filter((x) => x.stage === 'published');
  if (published.length) lines.push(`Published videos tracked in KROOPY: ${published.length}.`);

  const events = rows(state, 'events')
    .filter((e) => String(e.date ?? '') >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 12);
  if (events.length) {
    lines.push('\nUpcoming calendar:');
    for (const e of events) lines.push(`- ${e.date}${e.startTime ? ` ${e.startTime}` : ''} · ${clip(e.title, 60)} (${e.type})`);
  }

  const tasks = rows(state, 'tasks').filter((t) => t.status !== 'done');
  if (tasks.length) {
    lines.push(`\nOpen tasks (${tasks.length}; due soonest first):`);
    const sorted = [...tasks].sort((a, b) => String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')));
    for (const t of sorted.slice(0, 12)) lines.push(`- ${clip(t.title, 70)}${t.dueDate ? ` · due ${t.dueDate}` : ''}${t.priority ? ` · ${t.priority}` : ''}`);
  }

  const goals = rows(state, 'goals').filter((g) => g.status === 'active');
  if (goals.length) {
    lines.push('\nActive goals:');
    for (const g of goals.slice(0, 8)) lines.push(`- ${clip(g.title, 70)} · target ${g.target} ${clip(g.unit, 20)} by ${g.dueDate}`);
  }

  const stats = rows(state, 'analytics').sort((a, b) => String(b.publishedDate ?? '').localeCompare(String(a.publishedDate ?? '')));
  if (stats.length) {
    lines.push(`\nPerformance entries (entered by hand in KROOPY; ${stats.length} total, latest first):`);
    for (const s of stats.slice(0, 12))
      lines.push(`- ${s.publishedDate} · ${clip(s.title, 50)} · ${platform.get(String(s.platformId)) ?? s.platformId} · ${s.views} views, ${s.likes} likes, ${s.comments} comments, ${s.shares} shares, ${s.saves} saves${Number(s.followersGained) ? `, +${s.followersGained} followers` : ''}`);
  }

  const habits = rows(state, 'habits').filter((h) => !h.archived);
  if (habits.length) lines.push(`\nHabits tracked: ${habits.map((h) => clip(h.name, 30)).join(', ')}.`);

  if (lines.length === 1) lines.push('The workspace is still empty.');
  return lines.join('\n');
}
