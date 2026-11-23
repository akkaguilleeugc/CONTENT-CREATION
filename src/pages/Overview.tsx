import { format } from 'date-fns';
import {
  ArrowUpRight,
  CalendarClock,
  Clapperboard,
  Film,
  Lightbulb,
  ListChecks,
  Plus,
  Repeat,
  Scissors,
  Send,
  Sparkles,
  Upload,
  Video,
  CalendarDays,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatedNumber, BarChart, ProgressBar, ProgressRing } from '@/components/charts';
import { EmptyState } from '@/components/overlay';
import { Avatar, NotificationsButton } from '@/components/Shell';
import { Button, Checkbox, PlatformBadges, PlatformDots } from '@/components/ui';
import { AssetThumb } from '@/features/assets';
import { STAGES, stageLabel } from '@/lib/constants';
import { newTask } from '@/lib/factories';
import { spotlightHandlers, useNow } from '@/lib/hooks';
import { agendaFor, kpis, projectProgress, weekly, type AgendaItem } from '@/lib/metrics';
import { snapshot, useStore } from '@/lib/store';
import { openModal, toast, useUI } from '@/lib/ui';
import { cn, fmtMinutes, greeting, plural, relativeDay, todayStr } from '@/lib/utils';

const KIND_ICON = {
  task: ListChecks,
  publish: Send,
  recording: Video,
  editing: Scissors,
  event: CalendarDays,
  habit: Repeat,
} as const;
const KIND_LABEL = { task: 'Task', publish: 'Publish', recording: 'Recording', editing: 'Editing', event: 'Event', habit: 'Habit' } as const;

export default function Overview() {
  const now = useNow();
  const state = useStore();
  const db = useMemo(() => snapshot(state), [state]);
  const navigate = useNavigate();
  const setQuick = useUI((s) => s.setQuick);
  const today = todayStr();
  const k = useMemo(() => kpis(db, now), [db, now]);
  const agenda = useMemo(() => agendaFor(db, today, true), [db, today]);
  const week = useMemo(() => weekly(db, db.settings.weekStartsOn, now), [db, now]);
  const hasDemo = useMemo(() => [db.ideas, db.projects, db.tasks, db.habits, db.analytics].some((a) => a.some((r) => r.demo)), [db]);
  const name = db.settings.profile.name.split(' ')[0];

  const upcoming = useMemo(
    () =>
      db.projects
        .filter((p) => p.publishDate && p.publishDate >= today && p.stage !== 'published')
        .sort((a, b) => `${a.publishDate}${a.publishTime ?? ''}`.localeCompare(`${b.publishDate}${b.publishTime ?? ''}`))
        .slice(0, 6),
    [db.projects, today],
  );
  const active = useMemo(
    () =>
      db.projects
        .filter((p) => !['idea', 'published'].includes(p.stage))
        .sort((a, b) => (a.publishDate ?? '9999').localeCompare(b.publishDate ?? '9999'))
        .slice(0, 5),
    [db.projects],
  );

  const open = agenda.filter((a) => !a.done);
  const msg = (() => {
    const tasks = open.filter((a) => a.kind === 'task').length;
    const pubs = agenda.filter((a) => a.kind === 'publish' && !a.done).length;
    const rec = agenda.filter((a) => a.kind === 'recording' && !a.done).length;
    const parts = [tasks && plural(tasks, 'task'), rec && plural(rec, 'recording'), pubs && `${plural(pubs, 'post')} going live`].filter(Boolean);
    if (!parts.length) return agenda.length ? 'Everything for today is done. Time to capture new ideas.' : 'A clear day — perfect for capturing ideas and planning ahead.';
    return `Today: ${parts.join(', ')}.`;
  })();

  const kpiItems = [
    { label: 'Pending videos', value: k.pending, sub: 'idea → ready', icon: Lightbulb, to: '/studio' },
    { label: 'In production', value: k.inProduction, sub: 'rec · edit · review', icon: Film, to: '/studio' },
    { label: 'Scheduled', value: k.scheduled, sub: 'ready to go live', icon: CalendarClock, to: '/calendar' },
    { label: 'Published', value: k.publishedThisMonth, sub: format(now, 'MMMM'), icon: Send, to: '/studio', lime: true },
    { label: 'Open ideas', value: k.ideasPending, sub: 'in your idea bank', icon: Sparkles, to: '/ideas' },
    { label: 'Tasks to do', value: k.openTasks, sub: 'across all lists', icon: ListChecks, to: '/tasks' },
  ];

  return (
    <div className="page overview">
      <header className="ov-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{format(now, 'EEEE · d MMMM yyyy')}</div>
          <h1 className="ov-greet">
            {greeting(now)}
            {name ? `, ${name}` : ''}
            <span className="stop" aria-hidden />
          </h1>
          <p className="page-sub">
            {msg} <span className="accent-script">let’s create</span>
          </p>
        </div>
        <div className="ov-head__actions">
          <span className="hide-mobile">
            <NotificationsButton />
          </span>
          <Button variant="lime" icon={<Plus />} onClick={() => setQuick(true)} kbd="N">
            Quick create
          </Button>
          <Link to="/settings" className="hide-mobile" aria-label="Profile">
            <Avatar size={38} />
          </Link>
        </div>
      </header>

      {hasDemo && (
        <div className="demo-banner">
          <Sparkles size={15} />
          <span>You’re exploring with sample data.</span>
          <button
            onClick={() => {
              state.clearSample();
              toast('Sample data removed', { description: 'Your own records were kept.' });
            }}
          >
            Remove sample data
          </button>
        </div>
      )}

      <section className="kpis panel spotlight" {...spotlightHandlers()} aria-label="Activity summary">
        {kpiItems.map((x) => (
          <Link key={x.label} to={x.to} className={cn('kpi', x.lime && 'kpi--lime')}>
            <span className="kpi__icon">
              <x.icon />
            </span>
            <span className="kpi__value display">
              <AnimatedNumber value={x.value} />
            </span>
            <span className="kpi__label">{x.label}</span>
            <span className="kpi__sub">{x.sub}</span>
          </Link>
        ))}
      </section>

      <div className="ov-grid">
        <TodayPanel agenda={agenda} />
        <WeeklyPanel week={week} />
      </div>

      <section className="panel pipeline">
        <div className="panel__head">
          <h2 className="panel__title">
            Content pipeline <span className="count">{db.projects.length}</span>
          </h2>
          <Button size="sm" variant="ghost" icon={<ArrowUpRight />} onClick={() => navigate('/studio')}>
            Open studio
          </Button>
        </div>
        <div className="panel__body">
          <div className="pipe" role="list">
            {STAGES.map((s, i) => {
              const n = db.projects.filter((p) => p.stage === s.id).length;
              return (
                <button key={s.id} role="listitem" className={cn('pipe__stage', n > 0 && 'pipe__stage--on')} style={{ ['--i' as string]: i }} onClick={() => navigate(`/studio?stage=${s.id}`)} aria-label={`${s.label}: ${n}`}>
                  <span className="pipe__count display">{n}</span>
                  <span className="pipe__label">{s.label}</span>
                </button>
              );
            })}
          </div>
          <div className="pipe-gradient" aria-hidden>
            <span>idea</span>
            <span>production</span>
            <span>live</span>
          </div>
          {active.length === 0 ? (
            <EmptyState compact icon={<Clapperboard />} title="Nothing in production" text="Turn an idea into a video project to see it move through the pipeline." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'project' })}>New video</Button>} />
          ) : (
            <div className="active-list">
              {active.map((p) => {
                const prog = projectProgress(p);
                return (
                  <Link key={p.id} to={`/studio/${p.id}`} className="active-row">
                    <span className="active-row__title truncate">{p.title || 'Untitled video'}</span>
                    <span className="badge badge--accent">{stageLabel(p.stage)}</span>
                    <span className="active-row__bar">
                      <ProgressBar value={prog} label={`${p.title} progress`} />
                    </span>
                    <span className="active-row__pct tnum">{prog}%</span>
                    <span className="active-row__date subtle">{p.publishDate ? relativeDay(p.publishDate) : 'No date'}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">
            Upcoming content <span className="count">{upcoming.length}</span>
          </h2>
          <Button size="sm" variant="ghost" icon={<ArrowUpRight />} onClick={() => navigate('/calendar')}>
            Calendar
          </Button>
        </div>
        <div className="panel__body">
          {upcoming.length === 0 ? (
            <EmptyState compact icon={<CalendarClock />} title="No publications scheduled" text="Give a video a publish date and it will appear here." actions={<Button icon={<Plus />} onClick={() => openModal({ kind: 'project' })}>Plan a video</Button>} />
          ) : (
            <div className="upcoming">
              {upcoming.map((p) => (
                <Link key={p.id} to={`/studio/${p.id}`} className="up-card">
                  <UpThumb assetId={p.publication.thumbnailAssetId ?? p.publication.coverAssetId} vertical={p.format !== 'horizontal'} />
                  <div className="up-card__body">
                    <div className="up-card__when">
                      <span className="display">{relativeDay(p.publishDate)}</span>
                      {p.publishTime && <span className="mono">{p.publishTime}</span>}
                    </div>
                    <div className="up-card__title line-clamp-2">{p.title || 'Untitled video'}</div>
                    <div className="row between wrap gap-4">
                      <PlatformBadges ids={p.platformIds} compact max={2} />
                      <span className={cn('badge', p.stage === 'scheduled' ? 'badge--positive' : 'badge--danger')}>{p.stage === 'scheduled' ? 'Scheduled' : stageLabel(p.stage)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function UpThumb({ assetId, vertical }: { assetId?: string; vertical: boolean }) {
  const asset = useStore((s) => (assetId ? s.assets.find((a) => a.id === assetId) : undefined));
  return <AssetThumb asset={asset} className={cn('up-card__thumb', vertical && 'up-card__thumb--v')} />;
}

function TodayPanel({ agenda }: { agenda: AgendaItem[] }) {
  const s = useStore.getState();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const done = agenda.filter((a) => a.done).length;

  const toggleTask = (id: string, title: string, wasDone: boolean) => {
    s.toggleTask(id);
    if (!wasDone) toast('Task completed', { description: title, action: { label: 'Undo', run: () => useStore.getState().toggleTask(id) } });
  };
  const openItem = (a: AgendaItem) => {
    if (a.kind === 'task') openModal({ kind: 'task', id: a.refId });
    else if (a.kind === 'event') openModal({ kind: 'event', id: a.refId });
    else if (a.kind === 'habit') navigate('/trackers');
    else navigate(`/studio/${a.refId}`);
  };
  const add = () => {
    if (!draft.trim()) return;
    s.insert('tasks', newTask({ title: draft.trim(), dueDate: todayStr(), myDay: todayStr() }));
    setDraft('');
    toast('Added to today');
  };

  return (
    <section className="panel today">
      <div className="panel__head">
        <h2 className="panel__title">
          Today <span className="count">{done}/{agenda.length}</span>
        </h2>
        <Button size="sm" variant="ghost" icon={<ArrowUpRight />} onClick={() => navigate('/tasks')}>
          All tasks
        </Button>
      </div>
      <div className="panel__body">
        <form
          className="quick-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Plus size={16} />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task for today and press Enter" aria-label="Add a task for today" />
        </form>
        {agenda.length === 0 ? (
          <EmptyState compact icon={<Upload />} title="Nothing scheduled today" text="Tasks, recordings, edits and posts due today show up here." />
        ) : (
          <ul className="agenda">
            {agenda.map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <li key={a.key} className={cn('agenda__item', a.done && 'agenda__item--done', a.overdue && 'agenda__item--overdue')}>
                  {a.kind === 'task' ? (
                    <Checkbox round checked={!!a.done} onChange={() => toggleTask(a.refId, a.title, !!a.done)} label={`Complete ${a.title}`} />
                  ) : a.kind === 'habit' ? (
                    <Checkbox round checked={!!a.done} onChange={() => s.toggleHabit(a.refId, todayStr())} label={`Check ${a.title}`} />
                  ) : (
                    <span className={cn('agenda__kind', `agenda__kind--${a.kind}`)}>
                      <Icon />
                    </span>
                  )}
                  <button className="agenda__main" onClick={() => openItem(a)}>
                    <span className="agenda__title truncate">{a.title || 'Untitled'}</span>
                    <span className="agenda__meta">
                      <span>{a.overdue ? 'Overdue' : KIND_LABEL[a.kind]}</span>
                      {a.meta && <span>· {a.meta}</span>}
                      {a.platformIds && <PlatformDots ids={a.platformIds} />}
                    </span>
                  </button>
                  <span className="agenda__time mono">{a.time ?? ''}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function WeeklyPanel({ week }: { week: ReturnType<typeof weekly> }) {
  const projects = useStore((s) => s.projects);
  const inProd = projects.filter((p) => ['recording', 'editing', 'review'].includes(p.stage)).length;
  const scheduled = projects.filter((p) => p.stage === 'scheduled').length;
  const rings = [
    { label: 'Tasks', value: week.tasksDone, of: week.tasksTotal, pct: week.tasksTotal ? (week.tasksDone / week.tasksTotal) * 100 : 0 },
    { label: 'Produced', value: week.produced, of: week.produced + inProd, pct: week.produced + inProd ? (week.produced / (week.produced + inProd)) * 100 : 0 },
    { label: 'Published', value: week.published, of: week.published + scheduled, pct: week.published + scheduled ? (week.published / (week.published + scheduled)) * 100 : 0 },
    { label: 'Goals met', value: week.goalsMet, of: week.goalsTotal, pct: week.goalsTotal ? (week.goalsMet / week.goalsTotal) * 100 : 0, accent: true },
  ];
  const todayIdx = week.days.findIndex((d) => d.date === todayStr());
  return (
    <section className="panel weekly">
      <div className="panel__head">
        <h2 className="panel__title">Weekly progress</h2>
        <span className="eyebrow">
          {format(week.start, 'd MMM')} – {format(week.end, 'd MMM')}
        </span>
      </div>
      <div className="panel__body">
        <div className="rings">
          {rings.map((r) => (
            <div key={r.label} className="rings__item">
              <ProgressRing value={r.pct} size={78} stroke={7} accent={r.accent} label={`${r.label}: ${r.value} of ${r.of}`}>
                <span className="display" style={{ fontSize: 22 }}>
                  <AnimatedNumber value={r.value} />
                </span>
              </ProgressRing>
              <span className="rings__label">{r.label}</span>
              <span className="rings__sub tnum">of {r.of}</span>
            </div>
          ))}
        </div>
        <div className="row between" style={{ margin: '18px 0 8px' }}>
          <span className="eyebrow">Tasks completed per day</span>
          <span className="subtle tnum" style={{ fontSize: 12 }}>{week.tasksDone} this week</span>
        </div>
        <BarChart
          height={120}
          highlight={todayIdx}
          data={week.days.map((d) => ({ label: format(new Date(`${d.date}T00:00`), 'EEEEE'), value: d.tasks }))}
          format={(n) => String(n)}
        />
        <div className="week-stats">
          <div>
            <span className="display">{fmtMinutes(week.minutes)}</span>
            <span>creating</span>
          </div>
          <div>
            <span className="display"><AnimatedNumber value={week.habitCheckins} /></span>
            <span>habit check-ins</span>
          </div>
          <div>
            <span className="display"><AnimatedNumber value={week.ideasCaptured} /></span>
            <span>ideas captured</span>
          </div>
        </div>
      </div>
    </section>
  );
}
