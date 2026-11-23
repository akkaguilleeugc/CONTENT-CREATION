import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth, subDays, subWeeks } from 'date-fns';
import { Archive, BarChart2, Flag, Flame, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Square, Target, Timer, Trash2, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatedNumber, BarChart, ProgressBar, ProgressRing, RankBars } from '@/components/charts';
import { EmptyState, Menu } from '@/components/overlay';
import { Button, PageHeader, Select, Tabs } from '@/components/ui';
import { GOAL_METRICS, GOAL_PERIODS, WEEKDAYS_SHORT, WORK_ACTIVITIES } from '@/lib/constants';
import { goalValue, habitScheduledOn, habitStats, producedAt } from '@/lib/metrics';
import { snapshot, useStore } from '@/lib/store';
import type { Goal, Habit, WorkActivity } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, fmtDate, fmtMinutes, plural, toDateStr, todayStr, weekStart } from '@/lib/utils';
import { newTimeLog } from '@/lib/factories';

type Tab = 'habits' | 'goals' | 'productivity';

export default function Trackers() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'habits';
  const habits = useStore((s) => s.habits);
  const goals = useStore((s) => s.goals);
  return (
    <div className="page">
      <PageHeader
        title="Trackers"
        sub={<>Discipline is a system. Habits, goals and the hours behind your content. <span className="accent-script">stay consistent</span></>}
        actions={
          tab === 'habits' ? (
            <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'habit' })}>New habit</Button>
          ) : tab === 'goals' ? (
            <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'goal' })}>New goal</Button>
          ) : (
            <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'timelog' })}>Log time</Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'habits', label: 'Habits', icon: <Repeat />, count: habits.filter((h) => !h.archived).length },
          { value: 'goals', label: 'Goals', icon: <Flag />, count: goals.filter((g) => g.status === 'active').length },
          { value: 'productivity', label: 'Productivity', icon: <Zap /> },
        ]}
      />
      <div style={{ marginTop: 18 }} key={tab} className="page-enter">
        {tab === 'habits' && <Habits />}
        {tab === 'goals' && <Goals />}
        {tab === 'productivity' && <Productivity />}
      </div>
    </div>
  );
}

/* ═══════════════ Habits ═══════════════ */
function freqLabel(h: Habit) {
  if (h.frequency === 'daily') return 'Every day';
  if (h.frequency === 'weekdays') return 'Weekdays';
  if (h.frequency === 'weekly') return `${h.target}× per week`;
  return h.days.map((d) => WEEKDAYS_SHORT[d]).join(' · ');
}

function Habits() {
  const habits = useStore((s) => s.habits);
  const logs = useStore((s) => s.habitLogs);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const today = new Date();
  const ws = weekStart(today, weekStartsOn);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const dueToday = active.filter((h) => h.frequency === 'weekly' || habitScheduledOn(h, today));
  const doneToday = dueToday.filter((h) => logs.some((l) => l.habitId === h.id && l.date === todayStr()));

  if (!habits.length)
    return (
      <div className="panel">
        <EmptyState icon={<Repeat />} title="No habits yet" text="Track the routines that make you a better creator — recording, reading, training, planning." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'habit' })}>Create a habit</Button>} />
      </div>
    );

  return (
    <div className="col gap-16">
      <div className="habit-summary panel">
        <ProgressRing value={dueToday.length ? (doneToday.length / dueToday.length) * 100 : 0} size={64} stroke={6}>
          <span className="tnum" style={{ fontWeight: 700 }}>{doneToday.length}/{dueToday.length}</span>
        </ProgressRing>
        <div>
          <div className="display" style={{ fontSize: 22 }}>{doneToday.length === dueToday.length && dueToday.length ? 'All habits done today' : 'Today’s habits'}</div>
          <div className="subtle" style={{ fontSize: 13 }}>{format(today, 'EEEE d MMMM')} · tap a day to check it in</div>
        </div>
      </div>
      <div className="habits panel">
        <div className="habits__head">
          <span />
          <div className="habits__days">
            {week.map((d) => (
              <span key={d.toISOString()} className={cn(toDateStr(d) === todayStr() && 'today')}>
                {format(d, 'EEEEE')}
                <b className="tnum">{format(d, 'd')}</b>
              </span>
            ))}
          </div>
          <span className="hide-mobile">Streak</span>
          <span className="hide-mobile">30 d</span>
          <span />
        </div>
        {active.map((h) => (
          <HabitRow key={h.id} h={h} week={week} open={openId === h.id} onToggleOpen={() => setOpenId(openId === h.id ? null : h.id)} />
        ))}
      </div>
      {archived.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" icon={<Archive />} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </Button>
          {showArchived && (
            <div className="habits panel mt-8">
              {archived.map((h) => (
                <HabitRow key={h.id} h={h} week={week} open={openId === h.id} onToggleOpen={() => setOpenId(openId === h.id ? null : h.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HabitRow({ h, week, open, onToggleOpen }: { h: Habit; week: Date[]; open: boolean; onToggleOpen: () => void }) {
  const logs = useStore((s) => s.habitLogs);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const st = useMemo(() => habitStats(h, logs, weekStartsOn), [h, logs, weekStartsOn]);
  const store = useStore.getState();
  const today = todayStr();
  return (
    <div className={cn('habit', open && 'habit--open', h.archived && 'habit--archived')} style={{ ['--hc' as string]: h.color }}>
      <div className="habit__row">
        <button className="habit__name" onClick={onToggleOpen} aria-expanded={open}>
          <span className="habit__swatch" />
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{h.name}</span>
            <span className="subtle" style={{ fontSize: 12 }}>
              {freqLabel(h)}
              {h.reminderTime ? ` · ${h.reminderTime}` : ''}
              {h.frequency === 'weekly' ? ` · ${st.thisWeek}/${h.target} this week` : ''}
            </span>
          </span>
        </button>
        <div className="habits__days">
          {week.map((d) => {
            const ds = toDateStr(d);
            const future = ds > today;
            const on = st.logged.has(ds);
            const scheduled = habitScheduledOn(h, d);
            return (
              <button
                key={ds}
                className={cn('hday', on && 'hday--on', !scheduled && 'hday--off', ds === today && 'hday--today')}
                disabled={future || h.archived}
                onClick={() => store.toggleHabit(h.id, ds)}
                aria-pressed={on}
                aria-label={`${h.name} on ${format(d, 'EEEE d MMMM')}`}
              />
            );
          })}
        </div>
        <span className="habit__stat hide-mobile">
          <Flame className={cn(st.streak > 0 && 'flame--on')} />
          <b className="tnum">{st.streak}</b>
          <span className="subtle">{h.frequency === 'weekly' ? 'wk' : 'd'}</span>
        </span>
        <span className="habit__stat hide-mobile">
          <b className="tnum">{st.rate}%</b>
        </span>
        <Menu
          items={[
            { label: 'Edit', icon: <Pencil />, onSelect: () => openModal({ kind: 'habit', id: h.id }) },
            { label: h.archived ? 'Restore' : 'Archive', icon: <Archive />, onSelect: () => store.update('habits', h.id, { archived: !h.archived }) },
            {
              label: 'Delete',
              icon: <Trash2 />,
              danger: true,
              separator: true,
              onSelect: async () => {
                if (await confirmDialog({ title: `Delete “${h.name}”?`, description: 'Its full history is deleted too.' })) {
                  store.deleteHabit(h.id);
                  toast('Habit deleted');
                }
              },
            },
          ]}
          trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label={`Actions for ${h.name}`} />}
        />
      </div>
      {open && <HabitDetail h={h} stats={st} />}
    </div>
  );
}

function HabitDetail({ h, stats }: { h: Habit; stats: ReturnType<typeof habitStats> }) {
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const store = useStore.getState();
  const weeks = 26;
  const start = weekStart(subWeeks(new Date(), weeks - 1), weekStartsOn);
  const today = todayStr();
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  return (
    <div className="habit__detail">
      <div className="habit__kpis">
        <div><span className="display">{stats.streak}</span><span>current streak</span></div>
        <div><span className="display">{stats.rate}%</span><span>last 30 days</span></div>
        <div><span className="display">{stats.total}</span><span>total check-ins</span></div>
        <div><span className="display">{stats.thisWeek}</span><span>this week</span></div>
      </div>
      {h.description && <p className="subtle" style={{ fontSize: 13 }}>{h.description}</p>}
      <div className="heatmap" role="grid" aria-label={`${h.name} history`}>
        {cols.map((col, wi) => (
          <div key={wi} className="heatmap__col">
            {col.map((d) => {
              const ds = toDateStr(d);
              const on = stats.logged.has(ds);
              const future = ds > today;
              return (
                <button
                  key={ds}
                  className={cn('heatmap__cell', on && 'heatmap__cell--on', future && 'heatmap__cell--future', !habitScheduledOn(h, d) && 'heatmap__cell--off')}
                  title={`${format(d, 'EEE d MMM')}${on ? ' · done' : ''}`}
                  disabled={future || h.archived}
                  onClick={() => store.toggleHabit(h.id, ds)}
                  aria-label={`${format(d, 'd MMM')} ${on ? 'done' : 'not done'}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="row between subtle" style={{ fontSize: 11.5 }}>
        <span>{format(start, 'MMM yyyy')}</span>
        <span>Created {fmtDate(h.createdAt, 'd MMM yyyy')}</span>
      </div>
    </div>
  );
}

/* ═══════════════ Goals ═══════════════ */
function Goals() {
  const goals = useStore((s) => s.goals);
  const state = useStore();
  const db = useMemo(() => snapshot(state), [state]);
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active');
  if (!goals.length)
    return (
      <div className="panel">
        <EmptyState icon={<Target />} title="No goals yet" text="Set daily, weekly, monthly or yearly goals. Automatic goals track themselves from your real activity." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'goal' })}>Set a goal</Button>} />
      </div>
    );
  const list = goals.filter((g) => (filter === 'all' ? true : filter === 'active' ? g.status === 'active' || g.status === 'paused' : g.status === 'achieved' || g.status === 'missed'));
  return (
    <div className="col gap-16">
      <div className="row">
        <Select sm value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} options={[{ value: 'active', label: 'Active & paused' }, { value: 'done', label: 'Achieved & missed' }, { value: 'all', label: 'All goals' }]} aria-label="Filter goals" style={{ width: 'auto' }} />
      </div>
      {GOAL_PERIODS.map((period) => {
        const group = list.filter((g) => g.period === period.id);
        if (!group.length) return null;
        return (
          <section key={period.id}>
            <h3 className="tgroup__title">{period.label} <span className="count tnum">{group.length}</span></h3>
            <div className="goal-grid">
              {group.map((g) => (
                <GoalCard key={g.id} g={g} v={goalValue(db, g)} />
              ))}
            </div>
          </section>
        );
      })}
      {!list.length && <div className="panel"><EmptyState compact icon={<Target />} title="Nothing in this view" /></div>}
    </div>
  );
}

function GoalCard({ g, v }: { g: Goal; v: ReturnType<typeof goalValue> }) {
  const store = useStore.getState();
  const metric = GOAL_METRICS.find((m) => m.id === g.metric)!;
  const daysLeft = differenceInCalendarDays(new Date(`${g.dueDate}T00:00`), new Date());
  const hit = v.pct >= 100;
  const platform = useStore((s) => s.settings.platforms.find((p) => p.id === g.platformId));
  return (
    <article className={cn('goal panel', hit && 'goal--hit')}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="goal__badges">
            {v.auto ? <span className="badge badge--accent"><Zap /> Auto</span> : <span className="badge">Manual</span>}
            {g.status !== 'active' && <span className={cn('badge', g.status === 'achieved' ? 'badge--positive' : g.status === 'missed' ? 'badge--danger' : '')} style={{ textTransform: 'capitalize' }}>{g.status}</span>}
            {hit && g.status === 'active' && <span className="badge badge--solid-lime">Target reached</span>}
          </div>
          <h4 className="goal__title">{g.title}</h4>
          <p className="subtle" style={{ fontSize: 12 }}>
            {metric.auto ? metric.label : 'Logged manually'}
            {platform ? ` · ${platform.name}` : ''}
          </p>
        </div>
        <Menu
          items={[
            { label: 'Edit', icon: <Pencil />, onSelect: () => openModal({ kind: 'goal', id: g.id }) },
            { label: 'Mark achieved', icon: <Flag />, onSelect: () => store.update('goals', g.id, { status: 'achieved' }), hidden: g.status === 'achieved' },
            { label: 'Reactivate', icon: <Play />, onSelect: () => store.update('goals', g.id, { status: 'active' }), hidden: g.status === 'active' },
            { label: 'Pause', icon: <Pause />, onSelect: () => store.update('goals', g.id, { status: 'paused' }), hidden: g.status !== 'active' },
            {
              label: 'Delete',
              icon: <Trash2 />,
              danger: true,
              separator: true,
              onSelect: async () => {
                if (await confirmDialog({ title: `Delete “${g.title}”?` })) {
                  store.deleteGoal(g.id);
                  toast('Goal deleted');
                }
              },
            },
          ]}
          trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label="Goal actions" />}
        />
      </div>
      <div className="goal__value">
        <span className="display">
          <AnimatedNumber value={v.value} />
        </span>
        <span className="subtle">/ {g.target.toLocaleString()} {g.unit}</span>
        <span className="goal__pct tnum">{Math.round(v.pct)}%</span>
      </div>
      <ProgressBar value={v.pct} lg label={`${g.title} progress`} />
      <div className="row between" style={{ fontSize: 12 }}>
        <span className={cn('subtle', daysLeft < 0 && !hit && 'danger-text')}>
          {daysLeft > 0 ? `${plural(daysLeft, 'day')} left` : daysLeft === 0 ? 'Due today' : `Ended ${fmtDate(g.dueDate, 'd MMM')}`}
          {' · '}
          {fmtDate(g.startDate, 'd MMM')} → {fmtDate(g.dueDate, 'd MMM')}
        </span>
        {!v.auto && (
          <Button size="sm" variant="lime" icon={<Plus />} onClick={() => openModal({ kind: 'goal-progress', goalId: g.id })}>
            Log
          </Button>
        )}
      </div>
    </article>
  );
}

/* ═══════════════ Productivity ═══════════════ */
const TIMER_KEY = 'creator-os:timer';
interface RunningTimer {
  start: number;
  activity: WorkActivity;
  projectId?: string;
}

function FocusTimer() {
  const projects = useStore((s) => s.projects);
  const [timer, setTimer] = useState<RunningTimer | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(TIMER_KEY) ?? 'null');
    } catch {
      return null;
    }
  });
  const [activity, setActivity] = useState<WorkActivity>(timer?.activity ?? 'editing');
  const [projectId, setProjectId] = useState(timer?.projectId ?? '');
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [timer]);
  const persist = (t: RunningTimer | null) => {
    setTimer(t);
    try {
      if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t));
      else localStorage.removeItem(TIMER_KEY);
    } catch {
      /* ignore */
    }
  };
  const elapsed = timer ? Math.floor((Date.now() - timer.start) / 1000) : 0;
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const stop = () => {
    if (!timer) return;
    const minutes = Math.round(elapsed / 60);
    persist(null);
    if (minutes < 1) return toast('Session under a minute — not logged', { tone: 'info' });
    useStore.getState().insert('timeLogs', newTimeLog({ minutes, activity: timer.activity, projectId: timer.projectId || undefined, date: toDateStr(new Date(timer.start)), note: 'Focus session' }));
    toast('Session logged', { description: `${fmtMinutes(minutes)} · ${timer.activity}` });
  };
  return (
    <div className={cn('timer panel', timer && 'timer--running')}>
      <div className="timer__clock mono" aria-live="polite">
        {hh}:{mm}
        <span>:{ss}</span>
      </div>
      <div className="timer__controls">
        <Select sm value={activity} onChange={(e) => setActivity(e.target.value as WorkActivity)} options={WORK_ACTIVITIES.map((a) => ({ value: a.id, label: a.label }))} disabled={!!timer} aria-label="Activity" />
        <Select sm value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.title || 'Untitled' }))} placeholder="No video" disabled={!!timer} aria-label="Video" />
        {timer ? (
          <Button variant="danger" icon={<Square />} onClick={stop}>
            Stop & log
          </Button>
        ) : (
          <Button variant="lime" icon={<Play />} onClick={() => persist({ start: Date.now(), activity, projectId: projectId || undefined })}>
            Start focus
          </Button>
        )}
      </div>
    </div>
  );
}

function Productivity() {
  const state = useStore();
  const { timeLogs, tasks, projects, ideas, habitLogs } = state;
  const now = new Date();
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const inMonth = (iso?: string) => !!iso && new Date(iso.length === 10 ? `${iso}T12:00` : iso) >= mStart && new Date(iso.length === 10 ? `${iso}T12:00` : iso) <= mEnd;
  const ws = weekStart(now, state.settings.weekStartsOn);
  const lastWs = addDays(ws, -7);
  const sumMin = (from: Date, to: Date) => timeLogs.filter((l) => l.date >= toDateStr(from) && l.date < toDateStr(to)).reduce((a, l) => a + l.minutes, 0);
  const thisWeek = sumMin(ws, addDays(ws, 7));
  const lastWeek = sumMin(lastWs, ws);
  const finished = projects.filter((p) => inMonth(producedAt(p))).length;
  const developed = ideas.filter((i) => i.projectId && inMonth(projects.find((p) => p.id === i.projectId)?.createdAt)).length;
  const tasksDone = tasks.filter((t) => t.status === 'done' && inMonth(t.completedAt)).length;

  const last30 = Array.from({ length: 30 }, (_, i) => toDateStr(subDays(now, 29 - i)));
  const activeDay = (ds: string) => ({
    tasks: tasks.filter((t) => t.completedAt && toDateStr(new Date(t.completedAt)) === ds).length,
    minutes: timeLogs.filter((l) => l.date === ds).reduce((a, l) => a + l.minutes, 0),
    habits: habitLogs.filter((l) => l.date === ds).length,
  });
  const days30 = last30.map((ds) => ({ ds, ...activeDay(ds) }));
  const productiveDays = days30.filter((d) => d.tasks + d.habits > 0 || d.minutes >= 30).filter((d) => inMonth(d.ds)).length;
  const last14 = days30.slice(-14);
  const byActivity = WORK_ACTIVITIES.map((a) => ({ key: a.id, label: a.label, value: timeLogs.filter((l) => l.activity === a.id && inMonth(l.date)).reduce((s, l) => s + l.minutes, 0) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const recent = [...timeLogs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 10);

  const kpi = [
    { label: 'Hours this week', value: Math.round((thisWeek / 60) * 10) / 10, sub: lastWeek ? `${thisWeek >= lastWeek ? '+' : ''}${Math.round(((thisWeek - lastWeek) / 60) * 10) / 10}h vs last week` : 'No data last week', icon: Timer },
    { label: 'Videos finished', value: finished, sub: format(now, 'MMMM'), icon: BarChart2 },
    { label: 'Ideas developed', value: developed, sub: 'converted to videos', icon: Zap },
    { label: 'Tasks completed', value: tasksDone, sub: format(now, 'MMMM'), icon: Target },
    { label: 'Productive days', value: productiveDays, sub: `of ${now.getDate()} this month`, icon: Flame },
  ];

  return (
    <div className="col gap-16">
      <FocusTimer />
      <div className="prod-kpis">
        {kpi.map((k) => (
          <div key={k.label} className="panel prod-kpi">
            <k.icon />
            <span className="display"><AnimatedNumber value={k.value} format={(n) => String(n)} /></span>
            <span className="prod-kpi__label">{k.label}</span>
            <span className="subtle" style={{ fontSize: 11.5 }}>{k.sub}</span>
          </div>
        ))}
      </div>
      <div className="ov-grid">
        <section className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Hours creating · last 14 days</h3>
          </div>
          <div className="panel__body">
            <BarChart height={170} highlight={13} data={last14.map((d) => ({ label: format(new Date(`${d.ds}T12:00`), 'd'), value: Math.round((d.minutes / 60) * 10) / 10 }))} format={(n) => (n ? `${n}h` : '')} />
            <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Productive days · last 30</div>
            <div className="streak-strip">
              {days30.map((d) => {
                const score = d.tasks + d.habits + Math.floor(d.minutes / 30);
                return <span key={d.ds} className="streak-strip__cell" data-l={Math.min(4, score)} title={`${format(new Date(`${d.ds}T12:00`), 'EEE d MMM')} · ${d.tasks} tasks · ${d.habits} habits · ${fmtMinutes(d.minutes)}`} />;
              })}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Where the time goes</h3>
            <span className="eyebrow">{format(now, 'MMMM')}</span>
          </div>
          <div className="panel__body">
            {byActivity.length ? <RankBars data={byActivity} format={fmtMinutes} /> : <p className="subtle" style={{ fontSize: 13 }}>Log time or run a focus session to see your breakdown.</p>}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel__head">
          <h3 className="panel__title">Recent sessions</h3>
          <Button size="sm" icon={<Plus />} onClick={() => openModal({ kind: 'timelog' })}>Log time</Button>
        </div>
        <div className="panel__body">
          {recent.length === 0 ? (
            <EmptyState compact icon={<Timer />} title="No time logged" text="Start a focus session above or log time manually." />
          ) : (
            <ul className="agenda">
              {recent.map((l) => (
                <li key={l.id} className="agenda__item">
                  <span className="cal-kind"><Timer /></span>
                  <button className="agenda__main" onClick={() => openModal({ kind: 'timelog', id: l.id })}>
                    <span className="agenda__title" style={{ textTransform: 'capitalize' }}>{l.activity}{l.projectId ? ` · ${projects.find((p) => p.id === l.projectId)?.title ?? ''}` : ''}</span>
                    <span className="agenda__meta">{fmtDate(l.date, 'EEE d MMM')}{l.note ? ` · ${l.note}` : ''}</span>
                  </button>
                  <span className="agenda__time mono">{fmtMinutes(l.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
