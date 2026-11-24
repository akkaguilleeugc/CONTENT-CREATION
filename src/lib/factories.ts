import {
  BRAND,
  DEFAULT_EDITING,
  DEFAULT_IDEA_CATEGORIES,
  DEFAULT_PLATFORMS,
  DEFAULT_PRODUCTION,
} from './constants';
import type {
  AnalyticsRecord,
  Asset,
  BrandColor,
  CalendarEvent,
  ColorCombo,
  ContentProject,
  DB,
  Goal,
  Habit,
  Idea,
  BrandFont,
  BrandProfile,
  Settings,
  Task,
  TimeLog,
  VisualReference,
} from './types';
import { nowISO, todayStr, uid } from './utils';

const base = () => {
  const t = nowISO();
  return { id: uid(), createdAt: t, updatedAt: t };
};

export const checklist = (labels: string[]) => labels.map((label) => ({ id: uid(), label, done: false }));

export function newIdea(p: Partial<Idea> = {}): Idea {
  return {
    ...base(),
    title: '',
    description: '',
    category: 'Other',
    platformIds: [],
    format: '',
    reference: '',
    priority: 'medium',
    status: 'inbox',
    tags: [],
    favorite: false,
    ...p,
  };
}

export function newProject(p: Partial<ContentProject> = {}, settings?: Settings): ContentProject {
  return {
    ...base(),
    title: '',
    description: '',
    platformIds: [],
    format: 'vertical',
    category: 'Other',
    goal: '',
    stage: 'idea',
    priority: 'medium',
    tags: [],
    concept: { originalIdea: '', objective: '', audience: '', message: '', references: '', inspiration: '' },
    script: { hook: '', intro: '', body: '', keyPoints: '', cta: '', closing: '' },
    shots: [],
    production: checklist(settings?.productionTemplate ?? DEFAULT_PRODUCTION),
    editing: checklist(settings?.editingTemplate ?? DEFAULT_EDITING),
    publication: { caption: '', hashtags: '', link: '' },
    assetIds: [],
    stageDates: {},
    ...p,
  };
}

export function newTask(p: Partial<Task> = {}): Task {
  return {
    ...base(),
    title: '',
    description: '',
    category: 'content',
    priority: 'medium',
    status: 'todo',
    reminder: null,
    recurrence: 'none',
    subtasks: [],
    order: Date.now(),
    ...p,
  };
}

export function newHabit(p: Partial<Habit> = {}): Habit {
  return {
    ...base(),
    name: '',
    description: '',
    frequency: 'daily',
    days: [1, 2, 3, 4, 5],
    target: 1,
    color: BRAND.lime,
    archived: false,
    ...p,
  };
}

export function newGoal(p: Partial<Goal> = {}): Goal {
  return {
    ...base(),
    title: '',
    description: '',
    period: 'monthly',
    metric: 'manual',
    target: 1,
    unit: '',
    startDate: todayStr(),
    dueDate: todayStr(),
    status: 'active',
    ...p,
  };
}

export function newEvent(p: Partial<CalendarEvent> = {}): CalendarEvent {
  return { ...base(), title: '', type: 'personal', date: todayStr(), notes: '', reminder: null, ...p };
}

export function newAnalytics(p: Partial<AnalyticsRecord> = {}): AnalyticsRecord {
  return {
    ...base(),
    title: '',
    platformId: 'tiktok',
    category: 'Other',
    format: 'vertical',
    publishedDate: todayStr(),
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    reach: 0,
    followersGained: 0,
    source: 'manual',
    ...p,
  };
}

export function newTimeLog(p: Partial<TimeLog> = {}): TimeLog {
  return { ...base(), date: todayStr(), minutes: 60, activity: 'editing', note: '', ...p };
}

export function newColor(p: Partial<BrandColor> & { paletteId: string }): BrandColor {
  return { ...base(), name: '', hex: '#2F5BFF', role: '', order: Date.now(), ...p };
}

export function newCombo(p: Partial<ColorCombo> = {}): ColorCombo {
  return { ...base(), name: '', background: BRAND.ink, foreground: BRAND.white, note: '', ...p };
}

export function newReference(p: Partial<VisualReference> = {}): VisualReference {
  return { ...base(), title: '', kind: 'inspiration', url: '', notes: '', tags: [], ...p };
}

export function newAsset(p: Partial<Asset> = {}): Asset {
  return {
    ...base(),
    name: '',
    type: 'image',
    mime: '',
    size: 0,
    tags: [],
    projectIds: [],
    brand: false,
    note: '',
    ...p,
  };
}

/* ── Fresh database ─────────────────────────────────────────── */
export function defaultSettings(): Settings {
  return {
    theme: 'dark',
    profile: { name: '', handle: '', role: 'Content creator' },
    platforms: DEFAULT_PLATFORMS.map((p) => ({ ...p })),
    ideaCategories: [...DEFAULT_IDEA_CATEGORIES],
    productionTemplate: [...DEFAULT_PRODUCTION],
    editingTemplate: [...DEFAULT_EDITING],
    weekStartsOn: 1,
    sidebarCollapsed: false,
    notifications: false,
    onboarded: false,
    liquidGlass: true,
  };
}

/* Records that version 1 pre-seeded with the app's own (KROOPY) identity.
   The Brand Kit now belongs entirely to the user, so these are removed on upgrade. */
const LEGACY_SEED = {
  palettes: ['palette-primary', 'palette-secondary'],
  colors: ['color-ink', 'color-navy', 'color-royal-blue', 'color-lime', 'color-white', 'color-ice', 'color-neon-lime', 'color-dark', 'color-hot-pink'],
  combos: ['combo-signature', 'combo-cta', 'combo-click', 'combo-neon'],
  assets: ['asset-kroopy-logo', 'asset-kroopy-symbol'],
};

export function emptyBrand(): BrandProfile {
  return { name: '', tagline: '', description: '', voice: [], logoBackground: '#FFFFFF', doList: [], dontList: [] };
}

export function newBrandFont(p: Partial<BrandFont> = {}): BrandFont {
  const id = uid();
  return { ...base(), id, name: '', family: `brand-font-${id.slice(0, 8)}`, role: 'display', usage: '', sample: '', order: Date.now(), ...p };
}

export const DB_VERSION = 2;

export function freshDB(): DB {
  return {
    version: DB_VERSION,
    ideas: [],
    projects: [],
    tasks: [],
    habits: [],
    habitLogs: [],
    goals: [],
    goalProgress: [],
    timeLogs: [],
    events: [],
    analytics: [],
    assets: [],
    folders: [],
    palettes: [],
    colors: [],
    combos: [],
    references: [],
    brandFonts: [],
    brand: emptyBrand(),
    settings: defaultSettings(),
    firedReminders: {},
  };
}

/** Bring an older or partial snapshot up to the current shape. */
export function migrate(raw: Partial<DB>): DB {
  const fresh = freshDB();
  const db = { ...fresh, ...raw } as DB;
  db.settings = { ...fresh.settings, ...(raw.settings ?? {}) };
  db.settings.profile = { ...fresh.settings.profile, ...(raw.settings?.profile ?? {}) };
  if (!db.settings.platforms?.length) db.settings.platforms = fresh.settings.platforms;
  db.brand = { ...emptyBrand(), ...(raw.brand ?? {}) };
  db.brandFonts = raw.brandFonts ?? [];

  if ((raw.version ?? 1) < 2) {
    // v1 → v2: the Brand Kit is the user's own brand — drop the app-identity seed, keep everything the user added.
    const seeded = (ids: string[]) => new Set(ids);
    const colorIds = seeded(LEGACY_SEED.colors);
    db.colors = db.colors.filter((c) => !colorIds.has(c.id));
    db.palettes = db.palettes.filter((p) => !LEGACY_SEED.palettes.includes(p.id) || db.colors.some((c) => c.paletteId === p.id));
    db.combos = db.combos.filter((c) => !LEGACY_SEED.combos.includes(c.id));
    db.assets = db.assets.filter((a) => !LEGACY_SEED.assets.includes(a.id));
    db.references = db.references.map((r) => (r.assetId && LEGACY_SEED.assets.includes(r.assetId) ? { ...r, assetId: undefined } : r));
    db.projects = db.projects.map((p) => ({ ...p, assetIds: p.assetIds.filter((id) => !LEGACY_SEED.assets.includes(id)) }));
  }
  db.version = DB_VERSION;
  return db;
}
