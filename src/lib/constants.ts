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
  { id: 'tiktok', name: 'TikTok', short: 'TT', color: '#FF0055', builtIn: true },
  { id: 'ig_reels', name: 'Instagram Reels', short: 'IG', color: '#D4F53C', builtIn: true },
  { id: 'ig_stories', name: 'Instagram Stories', short: 'ST', color: '#EFF8FF', builtIn: true },
  { id: 'yt_shorts', name: 'YouTube Shorts', short: 'YS', color: '#2F5BFF', builtIn: true },
  { id: 'yt_long', name: 'YouTube', short: 'YT', color: '#8EA6FF', builtIn: true },
];

export const FORMATS: { id: FormatId; label: string }[] = [
  { id: 'vertical', label: 'Vertical video' },
  { id: 'horizontal', label: 'Horizontal video' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'photo', label: 'Photo' },
  { id: 'story', label: 'Story' },
  { id: 'live', label: 'Live' },
];

export const DEFAULT_IDEA_CATEGORIES = [
  'Vlogs',
  'Lifestyle',
  'Unboxings',
  'Reviews',
  'Opinion',
  'Tech',
  'Experiences',
  'Storytelling',
  'Entertainment',
  'Personal',
  'Other',
];

export const PRIORITIES: { id: Priority; label: string; rank: number }[] = [
  { id: 'urgent', label: 'Urgent', rank: 4 },
  { id: 'high', label: 'High', rank: 3 },
  { id: 'medium', label: 'Medium', rank: 2 },
  { id: 'low', label: 'Low', rank: 1 },
];
export const priorityRank = (p: Priority) => PRIORITIES.find((x) => x.id === p)?.rank ?? 0;

export const IDEA_STATUSES: { id: IdeaStatus; label: string; hint: string }[] = [
  { id: 'inbox', label: 'Inbox', hint: 'Captured, not reviewed' },
  { id: 'interesting', label: 'Interesting', hint: 'Worth exploring' },
  { id: 'developing', label: 'Developing', hint: 'Shaping the angle' },
  { id: 'ready', label: 'Ready', hint: 'Ready to produce' },
  { id: 'converted', label: 'Converted', hint: 'Now a content project' },
  { id: 'archived', label: 'Archived', hint: 'Parked for later' },
];

export const STAGES: { id: Stage; label: string; short: string; phase: 'pre' | 'prod' | 'post' }[] = [
  { id: 'idea', label: 'Idea', short: 'Idea', phase: 'pre' },
  { id: 'planning', label: 'Planning', short: 'Plan', phase: 'pre' },
  { id: 'script', label: 'Script', short: 'Script', phase: 'pre' },
  { id: 'ready', label: 'Ready to Record', short: 'Ready', phase: 'pre' },
  { id: 'recording', label: 'Recording', short: 'Rec', phase: 'prod' },
  { id: 'editing', label: 'Editing', short: 'Edit', phase: 'prod' },
  { id: 'review', label: 'Review', short: 'Review', phase: 'prod' },
  { id: 'scheduled', label: 'Scheduled', short: 'Sched', phase: 'post' },
  { id: 'published', label: 'Published', short: 'Live', phase: 'post' },
];
export const stageIndex = (s: Stage) => STAGES.findIndex((x) => x.id === s);
export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)?.label ?? s;

export const PENDING_STAGES: Stage[] = ['idea', 'planning', 'script', 'ready'];
export const PRODUCTION_STAGES: Stage[] = ['recording', 'editing', 'review'];

export const TASK_CATEGORIES: { id: TaskCategory; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'learning', label: 'Learning' },
  { id: 'business', label: 'Business' },
  { id: 'other', label: 'Other' },
];

export const RECURRENCES: { id: Recurrence; label: string }[] = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Every weekday' },
  { id: 'weekly', label: 'Every week' },
  { id: 'monthly', label: 'Every month' },
];

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At time of event' },
  { value: 10, label: '10 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

export const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: 'recording', label: 'Recording day' },
  { id: 'editing', label: 'Editing session' },
  { id: 'meeting', label: 'Meeting / collab' },
  { id: 'personal', label: 'Personal' },
  { id: 'other', label: 'Other' },
];

export const GOAL_PERIODS: { id: GoalPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export const GOAL_METRICS: { id: GoalMetric; label: string; unit: string; auto: boolean }[] = [
  { id: 'manual', label: 'Manual — I log the progress', unit: '', auto: false },
  { id: 'videos_published', label: 'Videos published', unit: 'videos', auto: true },
  { id: 'videos_produced', label: 'Videos produced (edited or later)', unit: 'videos', auto: true },
  { id: 'tasks_completed', label: 'Tasks completed', unit: 'tasks', auto: true },
  { id: 'ideas_captured', label: 'Ideas captured', unit: 'ideas', auto: true },
  { id: 'habit_checkins', label: 'Habit check-ins', unit: 'check-ins', auto: true },
  { id: 'hours_created', label: 'Hours logged creating', unit: 'hours', auto: true },
  { id: 'followers_gained', label: 'Followers gained (from Analytics)', unit: 'followers', auto: true },
];

export const WORK_ACTIVITIES: { id: WorkActivity; label: string }[] = [
  { id: 'planning', label: 'Planning' },
  { id: 'scripting', label: 'Scripting' },
  { id: 'recording', label: 'Recording' },
  { id: 'editing', label: 'Editing' },
  { id: 'publishing', label: 'Publishing' },
  { id: 'admin', label: 'Admin' },
  { id: 'learning', label: 'Learning' },
];

export const ASSET_TYPES: { id: AssetType; label: string }[] = [
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'logo', label: 'Logos' },
  { id: 'thumbnail', label: 'Thumbnails' },
  { id: 'cover', label: 'Covers' },
  { id: 'template', label: 'Templates' },
  { id: 'graphic', label: 'Graphics' },
  { id: 'document', label: 'Documents' },
  { id: 'reference', label: 'References' },
  { id: 'font', label: 'Fonts' },
];

export const FONT_ROLES: { id: import('./types').FontRole; label: string; hint: string }[] = [
  { id: 'display', label: 'Display', hint: 'Headlines, titles, big numbers' },
  { id: 'text', label: 'Text', hint: 'Body copy, UI, captions' },
  { id: 'accent', label: 'Accent', hint: 'Decorative phrases and details' },
  { id: 'other', label: 'Other', hint: 'Anything else' },
];

export const REFERENCE_KINDS: { id: ReferenceKind; label: string }[] = [
  { id: 'design', label: 'Design reference' },
  { id: 'moodboard', label: 'Moodboard' },
  { id: 'photo', label: 'Photography' },
  { id: 'inspiration', label: 'Inspiration' },
  { id: 'screenshot', label: 'Screenshot' },
  { id: 'campaign', label: 'Campaign idea' },
];

export const DEFAULT_PRODUCTION = [
  'Prepare equipment',
  'Prepare location',
  'Set up lighting',
  'Record A-roll',
  'Record B-roll',
  'Record extra resources',
  'Review footage',
];

export const DEFAULT_EDITING = [
  'First cut',
  'Clip selection',
  'Music',
  'Subtitles',
  'Color',
  'Effects',
  'Export',
  'Final review',
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

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
