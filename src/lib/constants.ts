import type {
  AssetType,
  EventType,
  FormatId,
  GoalMetric,
  GoalPeriod,
  IdeaStatus,
  PlatformDef,
  Priority,
  Recurrence,
  ReferenceKind,
  Stage,
  TaskCategory,
  WorkActivity,
} from './types';

import { $t } from '@/lib/i18n';
export const BRAND = {
  ink: '#0B0F14',
  navy: '#0B1A5C',
  royal: '#2F5BFF',
  lime: '#D4F53C',
  white: '#FFFFFF',
  ice: '#EFF8FF',
  neonLime: '#BBEF1F',
  dark: '#0D0303',
  pink: '#FF0055',
} as const;

export const DEFAULT_PLATFORMS: PlatformDef[] = [
  { id: 'tiktok', name: $t("TikTok"), short: $t("TT"), color: '#FF0055', builtIn: true },
  { id: 'ig_reels', name: $t("Instagram Reels"), short: $t("IG"), color: '#D4F53C', builtIn: true },
  { id: 'ig_stories', name: $t("Instagram Stories"), short: $t("ST"), color: '#EFF8FF', builtIn: true },
  { id: 'yt_shorts', name: $t("YouTube Shorts"), short: $t("YS"), color: '#2F5BFF', builtIn: true },
  { id: 'yt_long', name: $t("YouTube"), short: $t("YT"), color: '#8EA6FF', builtIn: true },
];

export const FORMATS: { id: FormatId; label: string }[] = [
  { id: 'vertical', label: $t("Vertical video") },
  { id: 'horizontal', label: $t("Horizontal video") },
  { id: 'carousel', label: $t("Carousel") },
  { id: 'photo', label: $t("Photo") },
  { id: 'story', label: $t("Story") },
  { id: 'live', label: $t("Live") },
];

export const DEFAULT_IDEA_CATEGORIES = [
  $t('Vlogs'),
  $t('Lifestyle'),
  $t('Unboxings'),
  $t('Reviews'),
  $t('Opinion'),
  $t('Tech'),
  $t('Experiences'),
  $t('Storytelling'),
  $t('Entertainment'),
  $t('Personal'),
  $t('Other'),
];

export const PRIORITIES: { id: Priority; label: string; rank: number }[] = [
  { id: 'urgent', label: $t("Urgent"), rank: 4 },
  { id: 'high', label: $t("High"), rank: 3 },
  { id: 'medium', label: $t("Medium"), rank: 2 },
  { id: 'low', label: $t("Low"), rank: 1 },
];
export const priorityRank = (p: Priority) => PRIORITIES.find((x) => x.id === p)?.rank ?? 0;

export const IDEA_STATUSES: { id: IdeaStatus; label: string; hint: string }[] = [
  { id: 'inbox', label: $t("Inbox"), hint: $t("Captured, not reviewed") },
  { id: 'interesting', label: $t("Interesting"), hint: $t("Worth exploring") },
  { id: 'developing', label: $t("Developing"), hint: $t("Shaping the angle") },
  { id: 'ready', label: $t("Ready"), hint: $t("Ready to produce") },
  { id: 'converted', label: $t("Converted"), hint: $t("Now a content project") },
  { id: 'archived', label: $t("Archived"), hint: $t("Parked for later") },
];

export const STAGES: { id: Stage; label: string; short: string; phase: 'pre' | 'prod' | 'post' }[] = [
  { id: 'idea', label: $t("Idea"), short: $t("Idea"), phase: 'pre' },
  { id: 'planning', label: $t("Planning"), short: $t("Plan"), phase: 'pre' },
  { id: 'script', label: $t("Script"), short: $t("Script"), phase: 'pre' },
  { id: 'ready', label: $t("Ready to Record"), short: $t("Ready"), phase: 'pre' },
  { id: 'recording', label: $t("Recording"), short: $t("Rec"), phase: 'prod' },
  { id: 'editing', label: $t("Editing"), short: $t("Edit"), phase: 'prod' },
  { id: 'review', label: $t("Review"), short: $t("Review"), phase: 'prod' },
  { id: 'scheduled', label: $t("Scheduled"), short: $t("Sched"), phase: 'post' },
  { id: 'published', label: $t("Published"), short: $t("Live"), phase: 'post' },
];
export const stageIndex = (s: Stage) => STAGES.findIndex((x) => x.id === s);
export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)?.label ?? s;

export const PENDING_STAGES: Stage[] = ['idea', 'planning', 'script', 'ready'];
export const PRODUCTION_STAGES: Stage[] = ['recording', 'editing', 'review'];

export const TASK_CATEGORIES: { id: TaskCategory; label: string }[] = [
  { id: 'content', label: $t("Content") },
  { id: 'personal', label: $t("Personal") },
  { id: 'work', label: $t("Work") },
  { id: 'learning', label: $t("Learning") },
  { id: 'business', label: $t("Business") },
  { id: 'other', label: $t("Other") },
];

export const RECURRENCES: { id: Recurrence; label: string }[] = [
  { id: 'none', label: $t("Does not repeat") },
  { id: 'daily', label: $t("Every day") },
  { id: 'weekdays', label: $t("Every weekday") },
  { id: 'weekly', label: $t("Every week") },
  { id: 'monthly', label: $t("Every month") },
];

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: $t("No reminder") },
  { value: 0, label: $t("At time of event") },
  { value: 10, label: $t("10 minutes before") },
  { value: 30, label: $t("30 minutes before") },
  { value: 60, label: $t("1 hour before") },
  { value: 1440, label: $t("1 day before") },
];

export const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: 'recording', label: $t("Recording day") },
  { id: 'editing', label: $t("Editing session") },
  { id: 'meeting', label: $t("Meeting / collab") },
  { id: 'personal', label: $t("Personal") },
  { id: 'other', label: $t("Other") },
];

export const GOAL_PERIODS: { id: GoalPeriod; label: string }[] = [
  { id: 'daily', label: $t("Daily") },
  { id: 'weekly', label: $t("Weekly") },
  { id: 'monthly', label: $t("Monthly") },
  { id: 'yearly', label: $t("Yearly") },
];

export const GOAL_METRICS: { id: GoalMetric; label: string; unit: string; auto: boolean }[] = [
  { id: 'manual', label: $t("Manual — I log the progress"), unit: '', auto: false },
  { id: 'videos_published', label: $t("Videos published"), unit: 'videos', auto: true },
  { id: 'videos_produced', label: $t("Videos produced (edited or later)"), unit: 'videos', auto: true },
  { id: 'tasks_completed', label: $t("Tasks completed"), unit: 'tasks', auto: true },
  { id: 'ideas_captured', label: $t("Ideas captured"), unit: 'ideas', auto: true },
  { id: 'habit_checkins', label: $t("Habit check-ins"), unit: 'check-ins', auto: true },
  { id: 'hours_created', label: $t("Hours logged creating"), unit: 'hours', auto: true },
  { id: 'followers_gained', label: $t("Followers gained (from Analytics)"), unit: 'followers', auto: true },
];

export const WORK_ACTIVITIES: { id: WorkActivity; label: string }[] = [
  { id: 'planning', label: $t("Planning") },
  { id: 'scripting', label: $t("Scripting") },
  { id: 'recording', label: $t("Recording") },
  { id: 'editing', label: $t("Editing") },
  { id: 'publishing', label: $t("Publishing") },
  { id: 'admin', label: $t("Admin") },
  { id: 'learning', label: $t("Learning") },
];

export const ASSET_TYPES: { id: AssetType; label: string }[] = [
  { id: 'image', label: $t("Images") },
  { id: 'video', label: $t("Videos") },
  { id: 'audio', label: $t("Audio") },
  { id: 'logo', label: $t("Logos") },
  { id: 'thumbnail', label: $t("Thumbnails") },
  { id: 'cover', label: $t("Covers") },
  { id: 'template', label: $t("Templates") },
  { id: 'graphic', label: $t("Graphics") },
  { id: 'document', label: $t("Documents") },
  { id: 'reference', label: $t("References") },
  { id: 'font', label: $t("Fonts") },
];

export const FONT_ROLES: { id: import('./types').FontRole; label: string; hint: string }[] = [
  { id: 'display', label: $t("Display"), hint: $t("Headlines, titles, big numbers") },
  { id: 'text', label: $t("Text"), hint: $t("Body copy, UI, captions") },
  { id: 'accent', label: $t("Accent"), hint: $t("Decorative phrases and details") },
  { id: 'other', label: $t("Other"), hint: $t("Anything else") },
];

export const REFERENCE_KINDS: { id: ReferenceKind; label: string }[] = [
  { id: 'design', label: $t("Design reference") },
  { id: 'moodboard', label: $t("Moodboard") },
  { id: 'photo', label: $t("Photography") },
  { id: 'inspiration', label: $t("Inspiration") },
  { id: 'screenshot', label: $t("Screenshot") },
  { id: 'campaign', label: $t("Campaign idea") },
];

export const DEFAULT_PRODUCTION = [
  $t('Prepare equipment'),
  $t('Prepare location'),
  $t('Set up lighting'),
  $t('Record A-roll'),
  $t('Record B-roll'),
  $t('Record extra resources'),
  $t('Review footage'),
];

export const DEFAULT_EDITING = [
  $t('First cut'),
  $t('Clip selection'),
  $t('Music'),
  $t('Subtitles'),
  $t('Color'),
  $t('Effects'),
  $t('Export'),
  $t('Final review'),
];

export const SHOT_TYPES = [
  'Wide',
  'Medium',
  'Close-up',
  'Extreme close-up',
  'POV',
  'Over the shoulder',
  'Top shot',
  'Tracking',
  'Talking head',
  'B-roll',
];

export const HABIT_COLORS = ['#D4F53C', '#2F5BFF', '#FF0055', '#EFF8FF', '#BBEF1F', '#8EA6FF'];

export const WEEKDAYS_SHORT = [$t('Sun'), $t('Mon'), $t('Tue'), $t('Wed'), $t('Thu'), $t('Fri'), $t('Sat')];
