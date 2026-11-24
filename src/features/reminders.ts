/* In-app reminder engine: checks every 30 s while the app is open and fires each reminder once. */
import { habitScheduledOn } from '@/lib/metrics';
import { useStore } from '@/lib/store';
import { systemNotify } from '@/lib/pwa';
import { toast } from '@/lib/ui';
import { dateTime, toDateStr } from '@/lib/utils';

import { $t } from '@/lib/i18n';
const WINDOW = 6 * 60 * 60 * 1000; // ignore reminders that are more than 6 h stale

function notify(title: string, body: string, url: string) {
  toast(title, { tone: 'info', description: body });
  if (useStore.getState().settings.notifications) void systemNotify(title, body, url);
}

export function checkReminders(now = new Date()) {
  const s = useStore.getState();
  if (!s.hydrated) return;
  const t = now.getTime();
  const due = (key: string, at: Date | null) => !!at && t >= at.getTime() && t - at.getTime() < WINDOW && !s.firedReminders[key];

  for (const task of s.tasks) {
    if (task.status === 'done' || task.reminder === null || !task.dueDate) continue;
    const at = dateTime(task.dueDate, task.dueTime ?? '09:00');
    if (!at) continue;
    const fire = new Date(at.getTime() - task.reminder * 60_000);
    const key = `task:${task.id}:${task.dueDate}:${task.dueTime ?? ''}:${task.reminder}`;
    if (due(key, fire)) {
      s.markReminder(key);
      notify(`${$t('Reminder')} · ${task.title}`, task.dueTime ? (task.dueDate === toDateStr(now) ? $t('Due today at {time}', { time: task.dueTime }) : $t('Due {date} at {time}', { date: task.dueDate!, time: task.dueTime })) : $t('Due today'), '/tasks');
    }
  }
  for (const ev of s.events) {
    if (ev.reminder === null || !ev.startTime) continue;
    const at = dateTime(ev.date, ev.startTime);
    if (!at) continue;
    const key = `event:${ev.id}:${ev.date}:${ev.startTime}:${ev.reminder}`;
    if (due(key, new Date(at.getTime() - ev.reminder * 60_000))) {
      s.markReminder(key);
      notify(`${$t('Coming up')} · ${ev.title}`, $t('Starts at {time}', { time: ev.startTime! }), '/calendar');
    }
  }
  for (const p of s.projects) {
    if (p.stage !== 'scheduled' || !p.publishDate || !p.publishTime) continue;
    const key = `publish:${p.id}:${p.publishDate}:${p.publishTime}`;
    if (due(key, dateTime(p.publishDate, p.publishTime))) {
      s.markReminder(key);
      notify(`Time to publish · ${p.title}`, 'Mark it as published once it’s live.', `/studio/${p.id}`);
    }
  }
  const today = toDateStr(now);
  for (const h of s.habits) {
    if (h.archived || !h.reminderTime || !habitScheduledOn(h, now)) continue;
    if (s.habitLogs.some((l) => l.habitId === h.id && l.date === today)) continue;
    const key = `habit:${h.id}:${today}`;
    if (due(key, dateTime(today, h.reminderTime))) {
      s.markReminder(key);
      notify(`${$t('Habit')} · ${h.name}`, $t('Keep the streak alive.'), '/trackers');
    }
  }
}

export function startReminders() {
  checkReminders();
  const id = setInterval(checkReminders, 30_000);
  return () => clearInterval(id);
}
