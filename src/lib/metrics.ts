/* Derived numbers. Everything here is computed from stored records — nothing is invented. */
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { PENDING_STAGES, PRODUCTION_STAGES } from './constants';
import type { AnalyticsRecord, ContentProject, DB, Goal, Habit, HabitLog, Stage } from './types';
import { dateTime, parseDate, toDateStr, todayStr, weekStart } from './utils';

const inRange = (iso: string | undefined, start: Date, end: Date) => {
  if (!iso) return false;
  const d = iso.length === 10 ? parseDate(iso) : parseISO(iso);
  return !!d && isWithinInterval(d, { start, end });
};

/* ── Content ── */
const POST_REVIEW: Stage[] = ['review', 'scheduled', 'published'];
export const producedAt = (p: ContentProject) =>
  POST_REVIEW.map((s) => p.stageDates?.[s]).filter(Boolean).sort()[0];

export function kpis(db: DB, now = new Date()) {
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  return {
    pending: db.projects.filter((p) => PENDING_STAGES.includes(p.stage)).length,
    inProduction: db.projects.filter((p) => PRODUCTION_STAGES.includes(p.stage)).length,
    scheduled: db.projects.filter((p) => p.stage === 'scheduled').length,
    publishedThisMonth: db.projects.filter((p) => p.stage === 'published' && inRange(p.publishedAt, mStart, mEnd)).length,
    ideasPending: db.ideas.filter((i) => ['inbox', 'interesting', 'developing', 'ready'].includes(i.status)).length,
    openTasks: db.tasks.filter((t) => t.status !== 'done').length,
  };
}

export type AgendaKind = 'task' | 'publish' | 'recording' | 'editing' | 'event' | 'habit';
export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  title: string;
  time?: string;
  refId: string;
  done?: boolean;
  overdue?: boolean;
  meta?: string;
  platformIds?: string[];
}

export function agendaFor(db: DB, date: string, includeOverdue = false): AgendaItem[] {
  const items: AgendaItem[] = [];
  const today = todayStr();
  for (const t of db.tasks) {
    const isToday = t.dueDate === date || t.myDay === date;
    const overdue = includeOverdue && t.status !== 'done' && !!t.dueDate && t.dueDate < date;
    if (!isToday && !overdue) continue;
    if (t.status === 'done' && t.completedAt && toDateStr(parseISO(t.completedAt)) !== date && t.dueDate !== date) continue;
    items.push({
      key: `task-${t.id}`,
      kind: 'task',
      title: t.title,
      time: t.dueTime,
      refId: t.id,
      done: t.status === 'done',
      overdue: overdue && date === today,
      meta: t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : undefined,
    });
  }
  for (const p of db.projects) {
    if (p.publishDate === date && (p.stage === 'scheduled' || p.stage === 'published' || p.stage === 'review' || p.stage === 'editing'))
      items.push({ key: `pub-${p.id}`, kind: 'publish', title: p.title, time: p.publishTime, refId: p.id, done: p.stage === 'published', platformIds: p.platformIds });
    else if (p.publishDate === date && p.stage !== 'published')
      items.push({ key: `pub-${p.id}`, kind: 'publish', title: p.title, time: p.publishTime, refId: p.id, platformIds: p.platformIds, meta: 'Not ready' });
    if (p.recordDate === date)
      items.push({ key: `rec-${p.id}`, kind: 'recording', title: p.title, refId: p.id, done: ['editing', 'review', 'scheduled', 'published'].includes(p.stage) });
    if (p.editDate === date)
      items.push({ key: `edit-${p.id}`, kind: 'editing', title: p.title, refId: p.id, done: ['review', 'scheduled', 'published'].includes(p.stage) });
  }
  for (const e of db.events) {
    if (e.date === date) items.push({ key: `ev-${e.id}`, kind: 'event', title: e.title, time: e.startTime, refId: e.id, meta: e.endTime ? `until ${e.endTime}` : undefined });
  }
  const d = parseDate(date)!;
  for (const h of db.habits) {
    if (h.archived || !h.reminderTime || !habitScheduledOn(h, d)) continue;
    items.push({
      key: `habit-${h.id}`,
      kind: 'habit',
      title: h.name,
      time: h.reminderTime,
      refId: h.id,
      done: db.habitLogs.some((l) => l.habitId === h.id && l.date === date),
    });
  }
  return items.sort((a, b) => {
    if (!!a.overdue !== !!b.overdue) return a.overdue ? -1 : 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
}

export function weekly(db: DB, weekStartsOn: 0 | 1, now = new Date()) {
  const start = weekStart(now, weekStartsOn);
  const end = endOfWeek(now, { weekStartsOn });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const tasksDone = db.tasks.filter((t) => t.status === 'done' && inRange(t.completedAt, start, end));
  const produced = db.projects.filter((p) => inRange(producedAt(p), start, end));
  const published = db.projects.filter((p) => p.stage === 'published' && inRange(p.publishedAt, start, end));
  const tasksDue = db.tasks.filter((t) => inRange(t.dueDate, start, end));
  const active = db.goals.filter((g) => g.status !== 'paused');
  const goalsMet = active.filter((g) => goalValue(db, g).pct >= 100);
  const perDay = days.map((d) => {
    const ds = toDateStr(d);
    return {
      date: ds,
      tasks: tasksDone.filter((t) => toDateStr(parseISO(t.completedAt!)) === ds).length,
      minutes: db.timeLogs.filter((l) => l.date === ds).reduce((a, l) => a + l.minutes, 0),
      habits: db.habitLogs.filter((l) => l.date === ds).length,
    };
  });
  return {
    start,
    end,
    days: perDay,
    tasksDone: tasksDone.length,
    tasksTotal: Math.max(tasksDone.length, tasksDue.length),
    produced: produced.length,
    published: published.length,
    goalsMet: goalsMet.length,
    goalsTotal: active.length,
    minutes: perDay.reduce((a, d) => a + d.minutes, 0),
    habitCheckins: perDay.reduce((a, d) => a + d.habits, 0),
    ideasCaptured: db.ideas.filter((i) => inRange(i.createdAt, start, end)).length,
  };
}

/* ── Habits ── */
export function habitScheduledOn(h: Habit, d: Date): boolean {
  const dow = d.getDay();
  if (h.frequency === 'daily' || h.frequency === 'weekly') return true;
  if (h.frequency === 'weekdays') return dow >= 1 && dow <= 5;
  return h.days.includes(dow);
}

export function habitStats(h: Habit, logs: HabitLog[], weekStartsOn: 0 | 1, now = new Date()) {
  const own = new Set(logs.filter((l) => l.habitId === h.id).map((l) => l.date));
  const today = startOfDay(now);
  const created = startOfDay(parseISO(h.createdAt));
  const todayDone = own.has(toDateStr(today));

  let streak = 0;
  if (h.frequency === 'weekly') {
    // Consecutive weeks hitting the weekly target (current week counts once reached).
    let ws = weekStart(today, weekStartsOn);
    const countIn = (s: Date) => Array.from({ length: 7 }, (_, i) => toDateStr(addDays(s, i))).filter((x) => own.has(x)).length;
    if (countIn(ws) >= h.target) streak++;
    ws = addDays(ws, -7);
    while (ws >= addDays(created, -7) && countIn(ws) >= h.target) {
      streak++;
      ws = addDays(ws, -7);
    }
  } else {
    let d = todayDone ? today : subDays(today, 1);
    // Skip unscheduled days without breaking the chain.
    for (let guard = 0; guard < 1000; guard++) {
      if (d < created && !own.has(toDateStr(d))) break;
      if (!habitScheduledOn(h, d)) {
        d = subDays(d, 1);
        continue;
      }
      if (own.has(toDateStr(d))) {
        streak++;
        d = subDays(d, 1);
      } else break;
    }
  }

  // Completion over the last 30 days (or since creation).
  const windowStart = created > subDays(today, 29) ? created : subDays(today, 29);
  let scheduled = 0;
  let done = 0;
  const span = differenceInCalendarDays(today, windowStart);
  if (h.frequency === 'weekly') {
    const weeks = Math.max(1, Math.ceil((span + 1) / 7));
    scheduled = weeks * h.target;
    for (let i = 0; i <= span; i++) if (own.has(toDateStr(addDays(windowStart, i)))) done++;
    done = Math.min(done, scheduled);
  } else {
    for (let i = 0; i <= span; i++) {
      const d = addDays(windowStart, i);
      if (!habitScheduledOn(h, d)) continue;
      // Today only counts once it is done, so the rate does not drop at 00:01.
      if (i === span && !own.has(toDateStr(d))) continue;
      scheduled++;
      if (own.has(toDateStr(d))) done++;
    }
  }
  const ws = weekStart(today, weekStartsOn);
  const thisWeek = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(ws, i))).filter((x) => own.has(x)).length;
  return {
    streak,
    rate: scheduled ? Math.round((done / scheduled) * 100) : 0,
    total: own.size,
    todayDone,
    thisWeek,
    scheduledToday: habitScheduledOn(h, today),
    logged: own,
  };
}

/* ── Goals ── */
export function goalWindow(g: Goal) {
  return { start: startOfDay(parseDate(g.startDate) ?? new Date()), end: addDays(startOfDay(parseDate(g.dueDate) ?? new Date()), 1) };
}

export function goalValue(db: DB, g: Goal): { value: number; pct: number; auto: boolean } {
  const { start, end } = goalWindow(g);
  const within = (iso?: string) => {
    if (!iso) return false;
    const d = iso.length === 10 ? parseDate(iso) : parseISO(iso);
    return !!d && d >= start && d < end;
  };
  const byPlatform = (p: ContentProject) => !g.platformId || p.platformIds.includes(g.platformId);
  let value = 0;
  let auto = true;
  switch (g.metric) {
    case 'videos_published':
      value = db.projects.filter((p) => p.stage === 'published' && byPlatform(p) && within(p.publishedAt)).length;
      break;
    case 'videos_produced':
      value = db.projects.filter((p) => byPlatform(p) && within(producedAt(p))).length;
      break;
    case 'tasks_completed':
      value = db.tasks.filter((t) => t.status === 'done' && within(t.completedAt)).length;
      break;
    case 'ideas_captured':
      value = db.ideas.filter((i) => within(i.createdAt)).length;
      break;
    case 'habit_checkins':
      value = db.habitLogs.filter((l) => within(l.date)).length;
      break;
    case 'hours_created':
      value = Math.round((db.timeLogs.filter((l) => within(l.date)).reduce((a, l) => a + l.minutes, 0) / 60) * 10) / 10;
      break;
    case 'followers_gained':
      value = db.analytics
        .filter((a) => (!g.platformId || a.platformId === g.platformId) && within(a.publishedDate))
        .reduce((a, r) => a + r.followersGained, 0);
      break;
    default:
      auto = false;
      value = db.goalProgress.filter((p) => p.goalId === g.id).reduce((a, p) => a + p.value, 0);
  }
  return { value, pct: g.target > 0 ? Math.min(100, (value / g.target) * 100) : 0, auto };
}

/* ── Analytics ── */
export const interactions = (r: AnalyticsRecord) => r.likes + r.comments + r.shares + r.saves;
export const engagementRate = (r: AnalyticsRecord) => {
  const base = r.reach || r.views;
  return base > 0 ? (interactions(r) / base) * 100 : 0;
};

export function sumRecords(rs: AnalyticsRecord[]) {
  const t = rs.reduce(
    (a, r) => ({
      views: a.views + r.views,
      likes: a.likes + r.likes,
      comments: a.comments + r.comments,
      shares: a.shares + r.shares,
      saves: a.saves + r.saves,
      reach: a.reach + r.reach,
      followersGained: a.followersGained + r.followersGained,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, followersGained: 0 },
  );
  const base = t.reach || t.views;
  return { ...t, engagement: base ? ((t.likes + t.comments + t.shares + t.saves) / base) * 100 : 0, posts: rs.length };
}

/* ── Notifications ── */
export interface NoticeItem {
  key: string;
  tone: 'danger' | 'info' | 'accent';
  title: string;
  detail: string;
  href: string;
}

export function notices(db: DB, now = new Date()): NoticeItem[] {
  const out: NoticeItem[] = [];
  const today = toDateStr(now);
  const tomorrow = toDateStr(addDays(now, 1));
  const overdue = db.tasks.filter((t) => t.status !== 'done' && t.dueDate && (t.dueDate < today || (t.dueDate === today && t.dueTime && dateTime(t.dueDate, t.dueTime)! < now)));
  if (overdue.length)
    out.push({ key: 'overdue', tone: 'danger', title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, detail: overdue.slice(0, 3).map((t) => t.title).join(' · '), href: '/tasks' });
  const dueToday = db.tasks.filter((t) => t.status !== 'done' && t.dueDate === today && !overdue.includes(t));
  if (dueToday.length)
    out.push({ key: 'today', tone: 'info', title: `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`, detail: dueToday.slice(0, 3).map((t) => t.title).join(' · '), href: '/tasks' });
  for (const p of db.projects) {
    if (p.stage === 'published' || !p.publishDate) continue;
    if (p.publishDate === today || p.publishDate === tomorrow) {
      const notReady = p.stage !== 'scheduled';
      out.push({
        key: `pub-${p.id}`,
        tone: notReady ? 'danger' : 'accent',
        title: `${p.publishDate === today ? 'Today' : 'Tomorrow'}${p.publishTime ? ` ${p.publishTime}` : ''} · ${p.title || 'Untitled'}`,
        detail: notReady ? `Publishing soon but still in “${p.stage}”.` : 'Scheduled and ready to go live.',
        href: `/studio/${p.id}`,
      });
    }
    if (p.publishDate < today) {
      out.push({ key: `late-${p.id}`, tone: 'danger', title: `Missed publish date · ${p.title || 'Untitled'}`, detail: 'Reschedule it or mark it published.', href: `/studio/${p.id}` });
    }
    if (p.recordDate === today) out.push({ key: `rec-${p.id}`, tone: 'info', title: `Recording today · ${p.title}`, detail: `${p.shots.filter((s) => s.status === 'pending').length} shots pending`, href: `/studio/${p.id}` });
  }
  const pendingHabits = db.habits.filter((h) => !h.archived && h.reminderTime && habitScheduledOn(h, now) && h.reminderTime <= toTime(now) && !db.habitLogs.some((l) => l.habitId === h.id && l.date === today));
  if (pendingHabits.length)
    out.push({ key: 'habits', tone: 'accent', title: `${pendingHabits.length} habit${pendingHabits.length > 1 ? 's' : ''} left today`, detail: pendingHabits.map((h) => h.name).join(' · '), href: '/trackers' });
  return out;
}

export const toTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Overall completion of a production: stage reached (70 %) + checklists and shots (30 %). */
export function projectProgress(p: ContentProject) {
  const order: Stage[] = ['idea', 'planning', 'script', 'ready', 'recording', 'editing', 'review', 'scheduled', 'published'];
  if (p.stage === 'published') return 100;
  const items = [...p.production, ...p.editing];
  const done = items.filter((i) => i.done).length + p.shots.filter((s) => s.status !== 'pending').length;
  const total = items.length + p.shots.length;
  const stagePart = (order.indexOf(p.stage) / (order.length - 1)) * 70;
  return Math.round(stagePart + (total ? (done / total) * 30 : 0));
}
