/* In-app reminder engine: checks every 30 s while the app is open and fires each reminder once. */
import { habitScheduledOn } from '@/lib/metrics';
import { useStore } from '@/lib/store';
import { toast } from '@/lib/ui';
import { dateTime, toDateStr } from '@/lib/utils';

const WINDOW = 6 * 60 * 60 * 1000; // ignore reminders that are more than 6 h stale

function notify(title: string, body: string) {
  toast(title, { tone: 'info', description: body });
  const { settings } = useStore.getState();
  if (settings.notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/brand/kroopy-symbol.png', tag: title });
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
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
      notify(`Reminder · ${task.title}`, task.dueTime ? `Due ${task.dueDate === toDateStr(now) ? 'today' : task.dueDate} at ${task.dueTime}` : 'Due today');
    }
  }
  for (const ev of s.events) {
    if (ev.reminder === null || !ev.startTime) continue;
    const at = dateTime(ev.date, ev.startTime);
    if (!at) continue;
    const key = `event:${ev.id}:${ev.date}:${ev.startTime}:${ev.reminder}`;
    if (due(key, new Date(at.getTime() - ev.reminder * 60_000))) {
      s.markReminder(key);
      notify(`Coming up · ${ev.title}`, `Starts at ${ev.startTime}`);
    }
  }
  for (const p of s.projects) {
    if (p.stage !== 'scheduled' || !p.publishDate || !p.publishTime) continue;
    const key = `publish:${p.id}:${p.publishDate}:${p.publishTime}`;
    if (due(key, dateTime(p.publishDate, p.publishTime))) {
      s.markReminder(key);
      notify(`Time to publish · ${p.title}`, 'Mark it as published once it’s live.');
    }
  }
  const today = toDateStr(now);
  for (const h of s.habits) {
    if (h.archived || !h.reminderTime || !habitScheduledOn(h, now)) continue;
    if (s.habitLogs.some((l) => l.habitId === h.id && l.date === today)) continue;
    const key = `habit:${h.id}:${today}`;
    if (due(key, dateTime(today, h.reminderTime))) {
      s.markReminder(key);
      notify(`Habit · ${h.name}`, 'Keep the streak alive.');
    }
  }
}

export function startReminders() {
  checkReminders();
  const id = setInterval(checkReminders, 30_000);
  return () => clearInterval(id);
}
