/* ──────────────────────────────────────────────────────────────
   Domain model for Creator OS.
   Mirrors supabase/migrations/0001_init.sql so the local store can be
   swapped for a remote backend without touching the UI.
   ────────────────────────────────────────────────────────────── */

export type ID = string;
/** Local calendar date, `yyyy-MM-dd`. */
export type DateStr = string;
/** Local wall-clock time, `HH:mm`. */
export type TimeStr = string;
/** Full ISO timestamp (UTC), used for audit fields. */
export type Timestamp = string;

export interface Entity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Sample records are flagged so they can be removed in one click. */
  demo?: boolean;
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface PlatformDef {
  id: string;
  name: string;
  short: string;
  color: string;
  builtIn: boolean;
}

export type FormatId = 'vertical' | 'horizontal' | 'carousel' | 'photo' | 'story' | 'live';

/* ── Ideas ─────────────────────────────────────────────────── */
export type IdeaStatus = 'inbox' | 'interesting' | 'developing' | 'ready' | 'converted' | 'archived';

export interface Idea extends Entity {
  title: string;
  description: string;
  category: string;
  platformIds: string[];
  format: FormatId | '';
  reference: string;
  priority: Priority;
  status: IdeaStatus;
  tags: string[];
  favorite: boolean;
  projectId?: ID;
}

/* ── Content projects ──────────────────────────────────────── */
export type Stage =
  | 'idea'
  | 'planning'
  | 'script'
  | 'ready'
  | 'recording'
  | 'editing'
  | 'review'
  | 'scheduled'
  | 'published';

export interface ChecklistItem {
  id: ID;
  label: string;
  done: boolean;
}

export type ShotStatus = 'pending' | 'shot' | 'skipped';
export interface Shot {
  id: ID;
  description: string;
  type: string;
  location: string;
  gear: string;
  status: ShotStatus;
  notes: string;
}

export interface ContentProject extends Entity {
  title: string;
  description: string;
  platformIds: string[];
  format: FormatId | '';
  category: string;
  goal: string;
  stage: Stage;
  priority: Priority;
  publishDate?: DateStr;
  publishTime?: TimeStr;
  recordDate?: DateStr;
  editDate?: DateStr;
  /** Estimated duration in seconds. */
  duration?: number;
  ideaId?: ID;
  tags: string[];
  concept: {
    originalIdea: string;
    objective: string;
    audience: string;
    message: string;
    references: string;
    inspiration: string;
  };
  script: {
    hook: string;
    intro: string;
    body: string;
    keyPoints: string;
    cta: string;
    closing: string;
  };
  shots: Shot[];
  production: ChecklistItem[];
  editing: ChecklistItem[];
  publication: {
    caption: string;
    hashtags: string;
    link: string;
    coverAssetId?: ID;
    thumbnailAssetId?: ID;
  };
  assetIds: ID[];
  /** Set the first time the project reaches the `published` stage. */
  publishedAt?: Timestamp;
  /** First time the project reached each stage — powers weekly/monthly production stats. */
  stageDates: Partial<Record<Stage, Timestamp>>;
}

/* ── Tasks ─────────────────────────────────────────────────── */
export type TaskCategory = 'content' | 'personal' | 'work' | 'learning' | 'business' | 'other';
export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Task extends Entity {
  title: string;
  description: string;
  category: TaskCategory;
  priority: Priority;
  status: TaskStatus;
  dueDate?: DateStr;
  dueTime?: TimeStr;
  /** Minutes before the due date/time to remind; null = no reminder. */
  reminder: number | null;
  recurrence: Recurrence;
  projectId?: ID;
  subtasks: Subtask[];
  order: number;
  /** Date the task was pinned to "My Day". */
  myDay?: DateStr;
  completedAt?: Timestamp;
}

/* ── Trackers ──────────────────────────────────────────────── */
export type HabitFrequency = 'daily' | 'weekdays' | 'custom' | 'weekly';

export interface Habit extends Entity {
  name: string;
  description: string;
  frequency: HabitFrequency;
  /** Days of week (0 = Sunday) for `custom`. */
  days: number[];
  /** Times per week for `weekly`, target per day otherwise (always 1 for daily habits). */
  target: number;
  color: string;
  reminderTime?: TimeStr;
  archived: boolean;
}

export interface HabitLog {
  id: ID;
  habitId: ID;
  date: DateStr;
  createdAt: Timestamp;
}

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type GoalMetric =
  | 'manual'
  | 'videos_published'
  | 'videos_produced'
  | 'tasks_completed'
  | 'ideas_captured'
  | 'habit_checkins'
  | 'hours_created'
  | 'followers_gained';
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'missed';

export interface Goal extends Entity {
  title: string;
  description: string;
  period: GoalPeriod;
  metric: GoalMetric;
  /** Narrow an automatic metric to a platform (videos / followers). */
  platformId?: string;
  target: number;
  unit: string;
  startDate: DateStr;
  dueDate: DateStr;
  status: GoalStatus;
}

export interface GoalProgress {
  id: ID;
  goalId: ID;
  date: DateStr;
  value: number;
  note: string;
  createdAt: Timestamp;
}

export type WorkActivity = 'planning' | 'scripting' | 'recording' | 'editing' | 'publishing' | 'admin' | 'learning';
export interface TimeLog extends Entity {
  date: DateStr;
  minutes: number;
  activity: WorkActivity;
  projectId?: ID;
  note: string;
}

/* ── Calendar ──────────────────────────────────────────────── */
export type EventType = 'recording' | 'editing' | 'meeting' | 'personal' | 'other';
export interface CalendarEvent extends Entity {
  title: string;
  type: EventType;
  date: DateStr;
  startTime?: TimeStr;
  endTime?: TimeStr;
  projectId?: ID;
  notes: string;
  reminder: number | null;
}

/* ── Analytics ─────────────────────────────────────────────── */
export interface AnalyticsRecord extends Entity {
  projectId?: ID;
  /** Free title when the post is not tracked in Content Studio. */
  title: string;
  platformId: string;
  category: string;
  format: FormatId | '';
  publishedDate: DateStr;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  followersGained: number;
  /** Where the numbers came from. Only `manual` exists until an official API is configured. */
  source: 'manual';
}

/* ── Brand & assets ────────────────────────────────────────── */
export interface Palette {
  id: ID;
  name: string;
  description: string;
  order: number;
}

export interface BrandColor extends Entity {
  paletteId: ID;
  name: string;
  hex: string;
  role: string;
  order: number;
}

export interface ColorCombo extends Entity {
  name: string;
  background: string;
  foreground: string;
  accent?: string;
  note: string;
}

export type AssetType =
  | 'image'
  | 'video'
  | 'audio'
  | 'logo'
  | 'thumbnail'
  | 'cover'
  | 'template'
  | 'graphic'
  | 'document'
  | 'reference';

export interface AssetFolder {
  id: ID;
  name: string;
  color: string;
  createdAt: Timestamp;
}

export interface Asset extends Entity {
  name: string;
  type: AssetType;
  mime: string;
  size: number;
  /** Key in the binary file store (IndexedDB). */
  blobKey?: string;
  /** Static URL for files that ship with the app (brand originals). */
  src?: string;
  width?: number;
  height?: number;
  folderId?: ID;
  tags: string[];
  projectIds: ID[];
  /** Part of the brand kit. */
  brand: boolean;
  /** Shipped with the app; cannot be deleted. */
  system?: boolean;
  note: string;
}

export type ReferenceKind = 'design' | 'moodboard' | 'photo' | 'inspiration' | 'screenshot' | 'campaign';
export interface VisualReference extends Entity {
  title: string;
  kind: ReferenceKind;
  assetId?: ID;
  url: string;
  notes: string;
  tags: string[];
}

/* ── Settings ──────────────────────────────────────────────── */
export type ThemePref = 'dark' | 'light' | 'system';

export interface Settings {
  theme: ThemePref;
  profile: {
    name: string;
    handle: string;
    role: string;
    avatarAssetId?: ID;
  };
  platforms: PlatformDef[];
  ideaCategories: string[];
  productionTemplate: string[];
  editingTemplate: string[];
  weekStartsOn: 0 | 1;
  sidebarCollapsed: boolean;
  notifications: boolean;
  onboarded: boolean;
}

export interface DB {
  version: number;
  ideas: Idea[];
  projects: ContentProject[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  goalProgress: GoalProgress[];
  timeLogs: TimeLog[];
  events: CalendarEvent[];
  analytics: AnalyticsRecord[];
  assets: Asset[];
  folders: AssetFolder[];
  palettes: Palette[];
  colors: BrandColor[];
  combos: ColorCombo[];
  references: VisualReference[];
  settings: Settings;
  /** Reminder keys already delivered, so each fires once. */
  firedReminders: Record<string, number>;
}

export type Collection = Exclude<keyof DB, 'version' | 'settings' | 'firedReminders'>;
export type RecordOf<C extends Collection> = DB[C][number];
