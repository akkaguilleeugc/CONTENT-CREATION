/* Clearly-labelled sample data (every record has `demo: true`) — removable in one click from Settings. */
import { addDays, subDays } from 'date-fns';
import {
  newAnalytics,
  newEvent,
  newGoal,
  newHabit,
  newIdea,
  newProject,
  newTask,
  newTimeLog,
} from './factories';
import type { ContentProject, DB, HabitLog, Settings, Stage } from './types';
import { toDateStr, uid } from './utils';

export function buildSample(settings: Settings): Partial<DB> {
  const now = new Date();
  const d = (n: number) => toDateStr(addDays(now, n));
  const ts = (n: number, h = 12) => {
    const x = addDays(now, n);
    x.setHours(h, 0, 0, 0);
    return x.toISOString();
  };
  const demo = { demo: true as const };

  const ideas = [
    newIdea({ ...demo, title: '24h in Madrid with a €50 budget', description: 'Challenge format: every euro on screen, tally at the end.', category: 'Vlogs', platformIds: ['tiktok', 'yt_long'], format: 'vertical', priority: 'high', status: 'ready', tags: ['challenge', 'city'], favorite: true }),
    newIdea({ ...demo, title: 'Unboxing: the creator desk setup', description: 'Lights, mic, arm — real costs and what I would skip.', category: 'Unboxings', platformIds: ['yt_long'], format: 'horizontal', priority: 'medium', status: 'developing', tags: ['setup', 'gear'] }),
    newIdea({ ...demo, title: '3 editing tricks that doubled my retention', description: 'Pattern interrupts, J-cuts, captions in the safe zone.', category: 'Tech', platformIds: ['tiktok', 'ig_reels', 'yt_shorts'], format: 'vertical', priority: 'urgent', status: 'interesting', tags: ['editing', 'tutorial'], favorite: true }),
    newIdea({ ...demo, title: 'Honest opinion: is posting daily worth it?', category: 'Opinion', platformIds: ['ig_reels'], priority: 'medium', status: 'inbox', tags: ['opinion'] }),
    newIdea({ ...demo, title: 'Story time — my first brand deal', category: 'Storytelling', platformIds: ['tiktok'], priority: 'low', status: 'inbox' }),
    newIdea({ ...demo, title: 'Morning routine, but realistic', category: 'Lifestyle', platformIds: ['ig_stories', 'ig_reels'], priority: 'low', status: 'archived' }),
  ];

  const mk = (stage: Stage, p: Partial<ContentProject>) => {
    const proj = newProject({ ...demo, stage, ...p }, settings);
    const order: Stage[] = ['idea', 'planning', 'script', 'ready', 'recording', 'editing', 'review', 'scheduled', 'published'];
    const idx = order.indexOf(stage);
    proj.stageDates = Object.fromEntries(order.slice(0, idx + 1).map((s, i) => [s, ts(-(idx - i) * 2 - 1)]));
    const prodDone = Math.max(0, idx - 3);
    proj.production = proj.production.map((c, i) => ({ ...c, done: i < prodDone * 3 }));
    proj.editing = proj.editing.map((c, i) => ({ ...c, done: idx >= 6 || (idx === 5 && i < 4) }));
    if (stage === 'published') proj.publishedAt = ts(-2, 18);
    return proj;
  };

  const projects = [
    mk('published', { title: 'I tried the 5AM creator routine for a week', platformIds: ['tiktok', 'ig_reels'], category: 'Lifestyle', publishDate: d(-2), publishTime: '18:00', duration: 58, goal: 'Reach + follows', priority: 'high' }),
    mk('published', { title: 'Camera settings I use for every reel', platformIds: ['yt_shorts', 'tiktok'], category: 'Tech', publishDate: d(-6), publishTime: '19:30', duration: 45, priority: 'medium' }),
    mk('scheduled', { title: 'Budget city guide — Lisbon', platformIds: ['tiktok', 'ig_reels'], category: 'Vlogs', publishDate: d(1), publishTime: '18:00', duration: 72, priority: 'high' }),
    mk('review', { title: 'Desk setup tour 2026', platformIds: ['yt_long'], format: 'horizontal', category: 'Unboxings', publishDate: d(4), publishTime: '17:00', duration: 540, priority: 'medium' }),
    mk('editing', { title: '3 editing tricks that doubled my retention', platformIds: ['tiktok', 'yt_shorts'], category: 'Tech', publishDate: d(6), publishTime: '19:00', editDate: d(0), duration: 50, priority: 'urgent' }),
    mk('ready', { title: 'Coffee spots you need to try', platformIds: ['ig_reels'], category: 'Lifestyle', recordDate: d(0), publishDate: d(9), duration: 40, priority: 'medium' }),
    mk('script', { title: 'Why I stopped chasing trends', platformIds: ['tiktok', 'yt_long'], category: 'Opinion', recordDate: d(3), duration: 90, priority: 'low' }),
    mk('planning', { title: 'Q&A — 10K followers special', platformIds: ['ig_stories', 'tiktok'], category: 'Entertainment', priority: 'medium' }),
  ];
  projects[4]!.script = {
    hook: 'You’re losing viewers in the first 2 seconds — here’s the fix.',
    intro: 'I edited 100 videos this year and these three changes moved my retention the most.',
    body: '1. Pattern interrupt every 3–4 seconds.\n2. J-cuts so the audio leads the image.\n3. Captions inside the safe zone.',
    keyPoints: 'Show before/after retention graph.',
    cta: 'Save this for your next edit.',
    closing: 'Follow for part 2.',
  };
  projects[5]!.shots = [
    { id: uid(), description: 'Wide establishing shot of the street', type: 'Wide', location: 'Old town', gear: 'Gimbal', status: 'pending', notes: '' },
    { id: uid(), description: 'Close-up latte art pour', type: 'Extreme close-up', location: 'Café 1', gear: 'Macro lens', status: 'pending', notes: 'Ask barista first' },
    { id: uid(), description: 'Talking head intro', type: 'Talking head', location: 'Café 2', gear: 'Mic + tripod', status: 'pending', notes: '' },
  ];

  const tasks = [
    newTask({ ...demo, title: 'Reply to brand email (Lisbon collab)', category: 'business', priority: 'high', dueDate: d(0), dueTime: '11:00', reminder: 30 }),
    newTask({ ...demo, title: 'Export final cut — editing tricks video', category: 'content', priority: 'urgent', dueDate: d(0), projectId: projects[4]!.id, subtasks: [{ id: uid(), title: 'Colour pass', done: true }, { id: uid(), title: 'Captions', done: false }, { id: uid(), title: 'Export 4K', done: false }] }),
    newTask({ ...demo, title: 'Plan next week’s content', category: 'content', priority: 'medium', dueDate: d(0), recurrence: 'weekly' }),
    newTask({ ...demo, title: 'Invoice for October', category: 'business', priority: 'high', dueDate: d(-1) }),
    newTask({ ...demo, title: 'Gym', category: 'personal', priority: 'low', dueDate: d(0), dueTime: '19:00', recurrence: 'weekdays' }),
    newTask({ ...demo, title: 'Buy new SD cards', category: 'work', priority: 'medium', dueDate: d(2) }),
    newTask({ ...demo, title: 'Finish colour grading course module 3', category: 'learning', priority: 'medium', dueDate: d(5) }),
    newTask({ ...demo, title: 'Back up footage to drive', category: 'work', priority: 'low' }),
    newTask({ ...demo, title: 'Write captions for Lisbon guide', category: 'content', priority: 'medium', status: 'done', completedAt: ts(-1, 10), projectId: projects[2]!.id }),
    newTask({ ...demo, title: 'Storyboard Q&A special', category: 'content', priority: 'low', status: 'done', completedAt: ts(-2, 16) }),
  ];

  const habits = [
    newHabit({ ...demo, name: 'Record content', frequency: 'weekdays', color: '#D4F53C', reminderTime: '10:00', createdAt: subDays(now, 40).toISOString() }),
    newHabit({ ...demo, name: 'Read 20 pages', frequency: 'daily', color: '#2F5BFF', createdAt: subDays(now, 40).toISOString() }),
    newHabit({ ...demo, name: 'Workout', frequency: 'weekly', target: 4, color: '#FF0055', createdAt: subDays(now, 40).toISOString() }),
    newHabit({ ...demo, name: 'Review analytics', frequency: 'custom', days: [1, 4], color: '#EFF8FF', createdAt: subDays(now, 40).toISOString() }),
  ];
  const habitLogs: HabitLog[] = [];
  const patterns = [0.85, 0.7, 0.55, 0.9];
  habits.forEach((h, hi) => {
    for (let i = 1; i <= 38; i++) {
      // Deterministic pseudo-random pattern so the sample looks the same every time.
      const r = ((i * 9301 + hi * 49297) % 233280) / 233280;
      if (r < patterns[hi]!) habitLogs.push({ id: uid(), habitId: h.id, date: toDateStr(subDays(now, i)), createdAt: ts(-i) });
    }
  });

  const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const goals = [
    newGoal({ ...demo, title: 'Publish 12 videos this month', period: 'monthly', metric: 'videos_published', target: 12, unit: 'videos', startDate: monthStart, dueDate: monthEnd }),
    newGoal({ ...demo, title: '2 long-form YouTube videos', period: 'monthly', metric: 'videos_published', platformId: 'yt_long', target: 2, unit: 'videos', startDate: monthStart, dueDate: monthEnd }),
    newGoal({ ...demo, title: 'Reach 10K followers on TikTok', period: 'yearly', metric: 'manual', target: 10000, unit: 'followers', startDate: toDateStr(new Date(now.getFullYear(), 0, 1)), dueDate: toDateStr(new Date(now.getFullYear(), 11, 31)) }),
  ];
  const goalProgress = [{ id: uid(), goalId: goals[2]!.id, date: d(-30), value: 7400, note: 'Starting point', createdAt: ts(-30) }, { id: uid(), goalId: goals[2]!.id, date: d(-1), value: 1260, note: 'Growth this month', createdAt: ts(-1) }];

  const events = [
    newEvent({ ...demo, title: 'Shoot day — coffee spots', type: 'recording', date: d(0), startTime: '09:30', endTime: '13:00', projectId: projects[5]!.id }),
    newEvent({ ...demo, title: 'Call with Lisbon tourism board', type: 'meeting', date: d(1), startTime: '12:00', endTime: '12:45', reminder: 10 }),
    newEvent({ ...demo, title: 'Editing block', type: 'editing', date: d(2), startTime: '15:00', endTime: '18:00' }),
    newEvent({ ...demo, title: 'Dinner with friends', type: 'personal', date: d(3), startTime: '21:00' }),
  ];

  const rec = (title: string, platformId: string, day: number, views: number, er: number, category: string, format: ContentProject['format'], followers: number, projectId?: string) => {
    const interactions = Math.round(views * er);
    return newAnalytics({
      ...demo,
      title,
      platformId,
      publishedDate: d(day),
      views,
      reach: Math.round(views * 0.82),
      likes: Math.round(interactions * 0.72),
      comments: Math.round(interactions * 0.06),
      shares: Math.round(interactions * 0.1),
      saves: Math.round(interactions * 0.12),
      followersGained: followers,
      category,
      format,
      projectId,
    });
  };
  const analytics = [
    rec('I tried the 5AM creator routine for a week', 'tiktok', -2, 48200, 0.094, 'Lifestyle', 'vertical', 610, projects[0]!.id),
    rec('I tried the 5AM creator routine for a week', 'ig_reels', -2, 21300, 0.071, 'Lifestyle', 'vertical', 190, projects[0]!.id),
    rec('Camera settings I use for every reel', 'yt_shorts', -6, 15800, 0.058, 'Tech', 'vertical', 140, projects[1]!.id),
    rec('Camera settings I use for every reel', 'tiktok', -6, 30900, 0.082, 'Tech', 'vertical', 330, projects[1]!.id),
    rec('Weekend in Porto (carousel)', 'ig_reels', -12, 9400, 0.11, 'Vlogs', 'carousel', 85),
    rec('Studio lights explained', 'yt_long', -18, 6100, 0.064, 'Tech', 'horizontal', 120),
    rec('Day in my life — launch week', 'tiktok', -25, 61700, 0.087, 'Lifestyle', 'vertical', 840),
    rec('My first brand deal (story time)', 'tiktok', -33, 22800, 0.101, 'Storytelling', 'vertical', 260),
    rec('Desk tour (old)', 'yt_long', -41, 4800, 0.052, 'Unboxings', 'horizontal', 60),
    rec('Q&A teaser', 'ig_stories', -8, 3100, 0.04, 'Entertainment', 'story', 12),
  ];

  const timeLogs = [
    newTimeLog({ ...demo, date: d(0), minutes: 95, activity: 'editing', projectId: projects[4]!.id }),
    newTimeLog({ ...demo, date: d(-1), minutes: 150, activity: 'recording', projectId: projects[2]!.id }),
    newTimeLog({ ...demo, date: d(-2), minutes: 60, activity: 'scripting' }),
    newTimeLog({ ...demo, date: d(-3), minutes: 120, activity: 'editing', projectId: projects[3]!.id }),
    newTimeLog({ ...demo, date: d(-4), minutes: 45, activity: 'planning' }),
    newTimeLog({ ...demo, date: d(-6), minutes: 80, activity: 'publishing' }),
  ];

  return { ideas, projects, tasks, habits, habitLogs, goals, goalProgress, events, analytics, timeLogs };
}
