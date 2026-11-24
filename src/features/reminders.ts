/* Reminders: one planner decides what to remind and when.
   • While KROOPY is open, a check every 30 s fires due reminders on screen (and as system notifications).
   • When you're signed in, the upcoming reminders are handed to the KROOPY cloud, which delivers them as
     push notifications to your phone and computer even when the app is closed (src/lib/push.ts). */
import { addDays } from 'date-fns';
import { habitScheduledOn } from '@/lib/metrics';
import { useStore } from '@/lib/store';
import { systemNotify } from '@/lib/pwa';
import { toast } from '@/lib/ui';
import { dateTime, toDateStr } from '@/lib/utils';

import { $t } from '@/lib/i18n';
const WINDOW = 6 * 60 * 60 * 1000; // ignore reminders that are more than 6 h stale

export interface PlannedReminder {
  /** stable id: changes when the item's date/time/offset changes, so an edited reminder fires again */
  key: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

type State = ReturnType<typeof useStore.getState>;

/** Every reminder due between `from` and `to` (epoch ms). */
export function planReminders(s: State, from: number, to: number): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const add = (key: string, at: Date | null, title: string, body: string, url: string) => {
    if (!at) return;
    const t = at.getTime();
    if (t >= from && t <= to) out.push({ key, at: t, title, body, url });
  };

  for (const task of s.tasks) {
    if (task.status === 'done' || task.reminder === null || task.reminder === undefined || !task.dueDate) continue;
    const at = dateTime(task.dueDate, task.dueTime ?? '09:00');
    if (!at) continue;
    const fire = new Date(at.getTime() - task.reminder * 60_000);
    const sameDay = task.dueDate === toDateStr(fire);
    add(
      `task:${task.id}:${task.dueDate}:${task.dueTime ?? ''}:${task.reminder}`,
      fire,
      `${$t('Reminder')} · ${task.title}`,
      task.dueTime ? (sameDay ? $t('Due today at {time}', { time: task.dueTime }) : $t('Due {date} at {time}', { date: task.dueDate, time: task.dueTime })) : $t('Due today'),
      '/tasks',
    );
  }
  for (const ev of s.events) {
    if (ev.reminder === null || ev.reminder === undefined || !ev.startTime) continue;
    const at = dateTime(ev.date, ev.startTime);
    if (!at) continue;
    add(`event:${ev.id}:${ev.date}:${ev.startTime}:${ev.reminder}`, new Date(at.getTime() - ev.reminder * 60_000), `${$t('Coming up')} · ${ev.title}`, $t('Starts at {time}', { time: ev.startTime }), '/calendar');
  }
  for (const p of s.projects) {
    if (p.stage !== 'scheduled' || !p.publishDate || !p.publishTime) continue;
    add(`publish:${p.id}:${p.publishDate}:${p.publishTime}`, dateTime(p.publishDate, p.publishTime), `${$t('Time to publish')} · ${p.title}`, $t('Mark it as published once it’s live.'), `/studio/${p.id}`);
  }
  // Habits: one per scheduled day, skipped for days already checked in.
  const days = Math.min(15, Math.ceil((to - from) / 86_400_000) + 1);
  const start = new Date(from);
  for (const h of s.habits) {
    if (h.archived || !h.reminderTime) continue;
    for (let i = 0; i < days; i++) {
      const day = addDays(start, i);
      const dayStr = toDateStr(day);
      if (!habitScheduledOn(h, day)) continue;
      if (s.habitLogs.some((l) => l.habitId === h.id && l.date === dayStr)) continue;
      add(`habit:${h.id}:${dayStr}`, dateTime(dayStr, h.reminderTime), `${$t('Habit')} · ${h.name}`, $t('Keep the streak alive.'), '/trackers');
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function checkReminders(now = new Date()) {
  const s = useStore.getState();
  if (!s.hydrated) return;
  const t = now.getTime();
  for (const r of planReminders(s, t - WINDOW, t)) {
    if (s.firedReminders[r.key]) continue;
    s.markReminder(r.key);
    toast(r.title, { tone: 'info', description: r.body });
    // Same tag as the push notification, so the phone never shows the same reminder twice.
    if (s.settings.notifications) void systemNotify(r.title, r.body, r.url, r.key);
  }
}

export function startReminders() {
  checkReminders();
  const id = setInterval(checkReminders, 30_000);
  return () => clearInterval(id);
}
