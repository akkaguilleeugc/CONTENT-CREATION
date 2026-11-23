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
  Palette,
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
  };
}

export const PRIMARY_PALETTE_ID = 'palette-primary';
export const SECONDARY_PALETTE_ID = 'palette-secondary';

function brandPalettes(): { palettes: Palette[]; colors: BrandColor[]; combos: ColorCombo[] } {
  const palettes: Palette[] = [
    { id: PRIMARY_PALETTE_ID, name: 'Primary', description: 'Everyday interface and brand colours.', order: 0 },
    {
      id: SECONDARY_PALETTE_ID,
      name: 'Secondary · Neon Luxury',
      description: 'Campaigns, highlights and creative moments. Use sparingly.',
      order: 1,
    },
  ];
  const c = (paletteId: string, name: string, hex: string, role: string, order: number): BrandColor => ({
    ...newColor({ paletteId, name, hex, role, order }),
    id: `color-${name.toLowerCase().replace(/\s+/g, '-')}`,
  });
  const colors = [
    c(PRIMARY_PALETTE_ID, 'Ink', BRAND.ink, 'Base · dark theme background', 0),
    c(PRIMARY_PALETTE_ID, 'Navy', BRAND.navy, 'Depth · secondary surfaces', 1),
    c(PRIMARY_PALETTE_ID, 'Royal Blue', BRAND.royal, 'Primary · actions, selection, navigation', 2),
    c(PRIMARY_PALETTE_ID, 'Lime', BRAND.lime, 'The accent · progress, positives, highlights', 3),
    c(PRIMARY_PALETTE_ID, 'White', BRAND.white, 'Text + light surfaces', 4),
    c(SECONDARY_PALETTE_ID, 'Ice', BRAND.ice, 'Light theme surfaces', 0),
    c(SECONDARY_PALETTE_ID, 'Neon Lime', BRAND.neonLime, 'Glow & campaign highlights', 1),
    c(SECONDARY_PALETTE_ID, 'Dark', BRAND.dark, 'Deep campaign backgrounds', 2),
    c(SECONDARY_PALETTE_ID, 'Hot Pink', BRAND.pink, 'Creative accents only', 3),
  ];
  const combos: ColorCombo[] = [
    { ...newCombo({ name: 'Signature', background: BRAND.ink, foreground: BRAND.white, accent: BRAND.lime, note: 'Default dark UI.' }), id: 'combo-signature' },
    { ...newCombo({ name: 'Call to action', background: BRAND.royal, foreground: BRAND.white, accent: BRAND.lime, note: 'Primary buttons and links.' }), id: 'combo-cta' },
    { ...newCombo({ name: 'The click', background: BRAND.lime, foreground: BRAND.ink, note: 'Highlights, progress, special actions.' }), id: 'combo-click' },
    { ...newCombo({ name: 'Neon luxury', background: BRAND.dark, foreground: BRAND.ice, accent: BRAND.pink, note: 'Campaigns & creative drops.' }), id: 'combo-neon' },
  ];
  return { palettes, colors, combos };
}

function systemAssets(): Asset[] {
  return [
    {
      ...newAsset({
        name: 'KROOPY — logotype (horizontal)',
        type: 'logo',
        mime: 'image/png',
        size: 315249,
        src: '/brand/kroopy-logo.png',
        width: 5613,
        height: 1362,
        brand: true,
        system: true,
        tags: ['logo', 'primary'],
        note: 'Original file: /brand/original/1.png (untouched). Black artwork on transparent — place on light or lime backgrounds.',
      }),
      id: 'asset-kroopy-logo',
    },
    {
      ...newAsset({
        name: 'KROOPY — symbol',
        type: 'logo',
        mime: 'image/png',
        size: 297113,
        src: '/brand/kroopy-symbol.png',
        width: 3983,
        height: 2807,
        brand: true,
        system: true,
        tags: ['logo', 'symbol'],
        note: 'Original file: /brand/original/2.png (untouched). Use when space is compact (avatars, app icon, favicon).',
      }),
      id: 'asset-kroopy-symbol',
    },
  ];
}

export const DB_VERSION = 1;

export function freshDB(): DB {
  const { palettes, colors, combos } = brandPalettes();
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
    assets: systemAssets(),
    folders: [],
    palettes,
    colors,
    combos,
    references: [],
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
  // System brand assets always exist.
  for (const a of fresh.assets) if (!db.assets.some((x) => x.id === a.id)) db.assets.unshift(a);
  db.version = DB_VERSION;
  return db;
}
