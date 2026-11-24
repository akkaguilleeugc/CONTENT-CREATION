/* KROOPY AI in the conversation: confirmation cards for actions (the app creates the records only after
   the person accepts — the same way as creating them by hand, so they sync everywhere) and small status
   chips for what the assistant looks up or remembers. */
import { Brain, CalendarPlus, Check, Clapperboard, Lightbulb, ListChecks, Search, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { forgetMemory } from '@/lib/ai';
import { newEvent, newIdea, newProject, newTask } from '@/lib/factories';
import { $t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import type { EventType, Priority } from '@/lib/types';
import { toast } from '@/lib/ui';
import { cn } from '@/lib/utils';

export type ToolPart = {
  type: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'approval-requested' | 'approval-responded' | 'output-available' | 'output-error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
};
export const ACTIONS = ['save_ideas', 'create_tasks', 'add_events', 'create_video'] as const;
export type ActionName = (typeof ACTIONS)[number];
export const isAction = (name: string): name is ActionName => (ACTIONS as readonly string[]).includes(name);
export const toolName = (p: { type: string }) => p.type.slice(5);

type IdeaIn = { title: string; description?: string; category?: string; tags?: string[] };
type TaskIn = { title: string; description?: string; dueDate?: string; dueTime?: string; priority?: Priority };
type EventIn = { title: string; date: string; startTime?: string; endTime?: string; type?: EventType; notes?: string };
type VideoIn = { title: string; description?: string; hook?: string; body?: string; cta?: string; caption?: string; publishDate?: string };

const LIST_KEY: Partial<Record<ActionName, 'ideas' | 'tasks' | 'events'>> = { save_ideas: 'ideas', create_tasks: 'tasks', add_events: 'events' };

/** Carries out a confirmed action on this device (only the items the person kept); returns what the assistant is told. */
export function runAction(name: ActionName, raw: Record<string, unknown>, keep?: boolean[]) {
  const st = useStore.getState();
  const key = LIST_KEY[name];
  const all = key ? ((raw[key] as unknown[]) ?? []) : [];
  const input = key && keep ? { ...raw, [key]: all.filter((_, i) => keep[i] !== false) } : raw;
  const skipped = key ? all.length - ((input[key] as unknown[]) ?? []).length : 0;
  const created: { id: string; title: string }[] = [];
  if (name === 'save_ideas') {
    for (const i of (input.ideas as IdeaIn[]) ?? []) {
      const r = st.insert('ideas', newIdea({ title: i.title, description: i.description ?? '', category: i.category || st.settings.ideaCategories[0] || '', tags: i.tags ?? [] }));
      created.push({ id: r.id, title: r.title });
    }
  } else if (name === 'create_tasks') {
    for (const t of (input.tasks as TaskIn[]) ?? []) {
      const r = st.insert('tasks', newTask({ title: t.title, description: t.description ?? '', dueDate: t.dueDate, dueTime: t.dueTime, priority: t.priority ?? 'medium', category: 'content' }));
      created.push({ id: r.id, title: r.title });
    }
  } else if (name === 'add_events') {
    for (const e of (input.events as EventIn[]) ?? []) {
      const r = st.insert('events', newEvent({ title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime, type: e.type ?? 'other', notes: e.notes ?? '' }));
      created.push({ id: r.id, title: r.title });
    }
  } else if (name === 'create_video') {
    const v = input as unknown as VideoIn;
    const p = newProject({ title: v.title, description: v.description ?? '', publishDate: v.publishDate, stage: v.hook || v.body ? 'script' : 'idea' }, st.settings);
    p.script = { ...p.script, hook: v.hook ?? '', body: v.body ?? '', cta: v.cta ?? '' };
    p.publication = { ...p.publication, caption: v.caption ?? '' };
    const r = st.insert('projects', p);
    created.push({ id: r.id, title: r.title });
  }
  return { done: true, created: created.length, items: created, ...(skipped ? { skippedByPerson: skipped } : {}) };
}

const ICON: Record<ActionName, ReactNode> = { save_ideas: <Lightbulb />, create_tasks: <ListChecks />, add_events: <CalendarPlus />, create_video: <Clapperboard /> };
const WHERE: Record<ActionName, string> = { save_ideas: '/ideas', create_tasks: '/tasks', add_events: '/calendar', create_video: '/studio' };

function headline(name: ActionName, input: Record<string, unknown>) {
  const n = (k: string) => ((input[k] as unknown[]) ?? []).length;
  switch (name) {
    case 'save_ideas':
      return n('ideas') === 1 ? $t('Save 1 idea in My Ideas') : $t('Save {n} ideas in My Ideas', { n: n('ideas') });
    case 'create_tasks':
      return n('tasks') === 1 ? $t('Create 1 task') : $t('Create {n} tasks', { n: n('tasks') });
    case 'add_events':
      return n('events') === 1 ? $t('Add 1 event to your calendar') : $t('Add {n} events to your calendar', { n: n('events') });
    default:
      return $t('Create a video in Content Studio');
  }
}

function rowsOf(name: ActionName, input: Record<string, unknown>): { title: string; meta?: string; detail?: string }[] {
  const when = (d?: string, t1?: string, t2?: string) => [d, t1 && (t2 ? `${t1}–${t2}` : t1)].filter(Boolean).join(' · ');
  if (name === 'save_ideas') return ((input.ideas as IdeaIn[]) ?? []).map((i) => ({ title: i.title, meta: i.category, detail: i.description }));
  if (name === 'create_tasks') return ((input.tasks as TaskIn[]) ?? []).map((t) => ({ title: t.title, meta: when(t.dueDate, t.dueTime), detail: t.description }));
  if (name === 'add_events') return ((input.events as EventIn[]) ?? []).map((e) => ({ title: e.title, meta: when(e.date, e.startTime, e.endTime), detail: e.notes }));
  const v = input as unknown as VideoIn;
  return [{ title: v.title, meta: v.publishDate ? $t('Publish {date}', { date: v.publishDate }) : undefined, detail: v.hook ? `Hook: ${v.hook}` : v.description }];
}

/** A proposed action: shows exactly what will be created; nothing happens until the person accepts. */
export function ActionCard({ part, onAnswer }: { part: ToolPart; onAnswer: (output: Record<string, unknown>) => void }) {
  const name = toolName(part) as ActionName;
  const input = part.input ?? {};
  const [busy, setBusy] = useState(false);
  const items = rowsOf(name, input);
  const [keep, setKeep] = useState<boolean[]>(() => items.map(() => true));
  const multi = !!LIST_KEY[name] && items.length > 1;
  const chosen = keep.filter(Boolean).length;
  if (part.state === 'input-streaming') return <div className="ai-card ai-card--loading">{ICON[name]} {$t('Preparing…')}</div>;
  const answered = part.state === 'output-available' || part.state === 'output-error';
  const cancelled = answered && (part.state === 'output-error' || !!part.output?.cancelled);
  return (
    <div className={cn('ai-card', answered && (cancelled ? 'ai-card--cancelled' : 'ai-card--done'))}>
      <div className="ai-card__head">
        <span className="ai-card__icon">{ICON[name]}</span>
        <b>{headline(name, input)}</b>
      </div>
      <ul className="ai-card__list">
        {items.map((r, i) => (
          <li key={i} className={cn(multi && !answered && 'ai-card__item--pick', (answered ? !cancelled && Array.isArray(part.output?.kept) && !(part.output!.kept as number[]).includes(i) : !keep[i]) && 'ai-card__item--off')}>
            {multi && !answered && (
              <label className="ai-card__pick">
                <input type="checkbox" checked={keep[i] !== false} onChange={(e) => setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))} aria-label={r.title} />
              </label>
            )}
            <span className="ai-card__title">{r.title}</span>
            {r.meta && <span className="ai-card__meta">{r.meta}</span>}
            {r.detail && <span className="ai-card__detail">{r.detail.length > 160 ? `${r.detail.slice(0, 157)}…` : r.detail}</span>}
          </li>
        ))}
      </ul>
      {!answered ? (
        <div className="ai-card__actions">
          <Button
            variant="lime"
            size="sm"
            icon={<Check />}
            loading={busy}
            disabled={chosen === 0}
            onClick={() => {
              setBusy(true);
              try {
                const out = { ...runAction(name, input, multi ? keep : undefined), ...(multi ? { kept: keep.flatMap((k, j) => (k ? [j] : [])) } : {}) };
                onAnswer(out);
                toast($t('Done'), { tone: 'success', description: headline(name, input) });
              } catch (e) {
                onAnswer({ done: false, error: (e as Error).message });
              }
            }}
          >
            {multi && chosen < items.length ? $t('Confirm {n}', { n: chosen }) : $t('Confirm')}
          </Button>
          <Button size="sm" variant="ghost" icon={<X />} disabled={busy} onClick={() => onAnswer({ cancelled: true })}>
            {$t('Cancel')}
          </Button>
        </div>
      ) : cancelled ? (
        <p className="ai-card__status">{$t('Cancelled — nothing was created.')}</p>
      ) : (
        <p className="ai-card__status ai-card__status--ok">
          <Check /> {$t('Done')} · <Link to={WHERE[name]}>{$t('Open')}</Link>
        </p>
      )}
    </div>
  );
}

/** What the assistant looked up or remembered, shown small between the words. */
export function ToolChip({ part }: { part: ToolPart }) {
  const name = toolName(part);
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const input = part.input ?? {};
  const [forgotten, setForgotten] = useState(false);
  if (name === 'remember') {
    if (running) return <div className="ai-chip"><Brain /> {$t('Remembering…')}</div>;
    if (forgotten) return <div className="ai-chip ai-chip--muted"><Brain /> {$t('Forgotten')}</div>;
    const id = part.output?.id as string | undefined;
    return (
      <div className="ai-chip ai-chip--memory">
        <Brain /> <span>{$t('Kroo will remember:')} «{String(input.text ?? '')}»</span>
        {id && (
          <button
            type="button"
            className="ai-chip__undo"
            onClick={async () => {
              await forgetMemory(id).catch(() => undefined);
              setForgotten(true);
            }}
          >
            {$t('Forget')}
          </button>
        )}
      </div>
    );
  }
  let label: string;
  if (name === 'search_kroopy') {
    const q = Array.isArray(input.queries) ? (input.queries as string[]).slice(0, 3).join(' · ') : '';
    const n = Array.isArray(part.output?.results) ? (part.output!.results as unknown[]).length : 0;
    label = running ? $t('Searching your KROOPY…') : `${$t('Searched your KROOPY')}${q ? `: ${q}` : ''} · ${n === 1 ? $t('1 result') : $t('{n} results', { n })}`;
  } else if (name === 'get_schedule') label = running ? $t('Checking your calendar…') : $t('Checked your calendar ({from} → {to})', { from: String(input.from ?? ''), to: String(input.to ?? '') });
  else if (name === 'get_stats') label = running ? $t('Reviewing your statistics…') : $t('Reviewed your statistics');
  else label = running ? $t('Opening…') : $t('Opened the details');
  return (
    <div className={cn('ai-chip', running && 'ai-chip--running')}>
      <Search /> {label}
    </div>
  );
}
