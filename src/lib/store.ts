import { addDays, addMonths, addWeeks, isWeekend } from 'date-fns';
import { create } from 'zustand';
import { freshDB, migrate, newProject, newTask } from './factories';
import { announceSave, forgetFileUrl, localData, localFiles, onRemoteSave } from './persistence';
import type {
  BrandProfile,
  Collection,
  ContentProject,
  DB,
  RecordOf,
  Settings,
  Stage,
  Task,
} from './types';
import { nowISO, parseDate, toDateStr, todayStr, uid } from './utils';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Actions {
  insert<C extends Collection>(c: C, record: RecordOf<C>): RecordOf<C>;
  update<C extends Collection>(c: C, id: string, patch: Partial<RecordOf<C>>): void;
  remove<C extends Collection>(c: C, id: string): void;
  setSettings(patch: Partial<Settings>): void;
  setBrand(patch: Partial<BrandProfile>): void;

  convertIdea(ideaId: string): ContentProject | null;
  duplicateIdea(ideaId: string): void;
  duplicateProject(id: string): ContentProject | null;
  setStage(id: string, stage: Stage): void;
  deleteProject(id: string): void;
  toggleTask(id: string): void;
  reorderTasks(ids: string[]): void;
  toggleHabit(habitId: string, date: string): void;
  deleteHabit(id: string): void;
  deleteGoal(id: string): void;
  deleteAsset(id: string): Promise<void>;
  deleteFolder(id: string): void;
  deletePalette(id: string): void;
  linkAsset(assetId: string, projectId: string, linked: boolean): void;
  markReminder(key: string): void;

  loadSample(db: Partial<DB>): void;
  clearSample(): void;
  replaceAll(db: DB): void;
  resetAll(): Promise<void>;
}

interface Meta {
  hydrated: boolean;
  saveState: SaveState;
  lastSavedAt: number | null;
  rev: number;
}

export type Store = DB & Meta & Actions;

const touch = <T extends { updatedAt: string }>(r: T, patch: Partial<T>): T => ({ ...r, ...patch, updatedAt: nowISO() });

function nextDue(task: Task): string | undefined {
  const d = parseDate(task.dueDate) ?? new Date();
  switch (task.recurrence) {
    case 'daily':
      return toDateStr(addDays(d, 1));
    case 'weekdays': {
      let n = addDays(d, 1);
      while (isWeekend(n)) n = addDays(n, 1);
      return toDateStr(n);
    }
    case 'weekly':
      return toDateStr(addWeeks(d, 1));
    case 'monthly':
      return toDateStr(addMonths(d, 1));
    default:
      return undefined;
  }
}

export const useStore = create<Store>()((set, get) => {
  /** Every data mutation goes through `commit` so the save loop sees a new revision. */
  const commit = (fn: (s: Store) => Partial<DB>) => set((s) => ({ ...fn(s), rev: s.rev + 1 }));

  return {
    ...freshDB(),
    hydrated: false,
    saveState: 'idle',
    lastSavedAt: null,
    rev: 0,

    insert(c, record) {
      commit((s) => ({ [c]: [record, ...(s[c] as unknown[])] }) as Partial<DB>);
      return record;
    },
    update(c, id, patch) {
      commit(
        (s) =>
          ({
            [c]: (s[c] as { id: string; updatedAt?: string }[]).map((r) =>
              r.id === id ? ('updatedAt' in r ? touch(r as never, patch as never) : { ...r, ...patch }) : r,
            ),
          }) as Partial<DB>,
      );
    },
    remove(c, id) {
      commit((s) => ({ [c]: (s[c] as { id: string }[]).filter((r) => r.id !== id) }) as Partial<DB>);
    },
    setSettings(patch) {
      commit((s) => ({ settings: { ...s.settings, ...patch } }));
    },
    setBrand(patch) {
      commit((s) => ({ brand: { ...s.brand, ...patch, updatedAt: nowISO() } }));
    },

    convertIdea(ideaId) {
      const s = get();
      const idea = s.ideas.find((i) => i.id === ideaId);
      if (!idea) return null;
      if (idea.projectId && s.projects.some((p) => p.id === idea.projectId)) {
        return s.projects.find((p) => p.id === idea.projectId)!;
      }
      const project = newProject(
        {
          title: idea.title,
          description: idea.description,
          platformIds: idea.platformIds,
          format: idea.format || 'vertical',
          category: idea.category,
          priority: idea.priority,
          tags: idea.tags,
          stage: 'planning',
          stageDates: { planning: nowISO() },
          ideaId: idea.id,
          concept: {
            originalIdea: idea.description || idea.title,
            objective: '',
            audience: '',
            message: '',
            references: idea.reference,
            inspiration: '',
          },
        },
        s.settings,
      );
      commit((st) => ({
        projects: [project, ...st.projects],
        ideas: st.ideas.map((i) => (i.id === ideaId ? touch(i, { status: 'converted', projectId: project.id }) : i)),
      }));
      return project;
    },

    duplicateIdea(ideaId) {
      const idea = get().ideas.find((i) => i.id === ideaId);
      if (!idea) return;
      const t = nowISO();
      const copy = {
        ...idea,
        id: uid(),
        title: `${idea.title} (copy)`,
        status: idea.status === 'converted' ? ('ready' as const) : idea.status,
        projectId: undefined,
        createdAt: t,
        updatedAt: t,
        demo: false,
      };
      commit((s) => ({ ideas: [copy, ...s.ideas] }));
    },

    duplicateProject(id) {
      const p = get().projects.find((x) => x.id === id);
      if (!p) return null;
      const t = nowISO();
      const copy: ContentProject = {
        ...structuredClone(p),
        id: uid(),
        title: `${p.title} (copy)`,
        stage: 'planning',
        publishedAt: undefined,
        stageDates: { planning: t },
        createdAt: t,
        updatedAt: t,
        demo: false,
      };
      commit((s) => ({ projects: [copy, ...s.projects] }));
      return copy;
    },

    setStage(id, stage) {
      commit((s) => ({
        projects: s.projects.map((p) => {
          if (p.id !== id) return p;
          const patch: Partial<ContentProject> = { stage };
          if (!p.stageDates?.[stage]) patch.stageDates = { ...(p.stageDates ?? {}), [stage]: nowISO() };
          if (stage === 'published' && !p.publishedAt) {
            patch.publishedAt = nowISO();
            if (!p.publishDate) patch.publishDate = todayStr();
          }
          if (stage !== 'published' && p.publishedAt) patch.publishedAt = undefined;
          return touch(p, patch);
        }),
      }));
    },

    deleteProject(id) {
      commit((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t)),
        events: s.events.map((e) => (e.projectId === id ? { ...e, projectId: undefined } : e)),
        timeLogs: s.timeLogs.map((e) => (e.projectId === id ? { ...e, projectId: undefined } : e)),
        analytics: s.analytics.map((a) => (a.projectId === id ? { ...a, projectId: undefined } : a)),
        assets: s.assets.map((a) =>
          a.projectIds.includes(id) ? { ...a, projectIds: a.projectIds.filter((x) => x !== id) } : a,
        ),
        ideas: s.ideas.map((i) => (i.projectId === id ? { ...i, projectId: undefined, status: 'ready' as const } : i)),
      }));
    },

    toggleTask(id) {
      const task = get().tasks.find((t) => t.id === id);
      if (!task) return;
      const completing = task.status !== 'done';
      commit((s) => {
        let tasks = s.tasks.map((t) =>
          t.id === id
            ? touch(t, { status: completing ? 'done' : 'todo', completedAt: completing ? nowISO() : undefined })
            : t,
        );
        // Recurring tasks spawn their next occurrence when completed.
        if (completing && task.recurrence !== 'none') {
          const next = newTask({
            ...task,
            id: uid(),
            status: 'todo',
            completedAt: undefined,
            dueDate: nextDue(task),
            myDay: undefined,
            subtasks: task.subtasks.map((st) => ({ ...st, id: uid(), done: false })),
            demo: task.demo,
          });
          tasks = [next, ...tasks];
        }
        return { tasks };
      });
    },

    reorderTasks(ids) {
      const order = new Map(ids.map((id, i) => [id, i]));
      commit((s) => ({ tasks: s.tasks.map((t) => (order.has(t.id) ? { ...t, order: order.get(t.id)! } : t)) }));
    },

    toggleHabit(habitId, date) {
      const existing = get().habitLogs.find((l) => l.habitId === habitId && l.date === date);
      commit((s) => ({
        habitLogs: existing
          ? s.habitLogs.filter((l) => l.id !== existing.id)
          : [...s.habitLogs, { id: uid(), habitId, date, createdAt: nowISO() }],
      }));
    },

    deleteHabit(id) {
      commit((s) => ({ habits: s.habits.filter((h) => h.id !== id), habitLogs: s.habitLogs.filter((l) => l.habitId !== id) }));
    },
    deleteGoal(id) {
      commit((s) => ({ goals: s.goals.filter((g) => g.id !== id), goalProgress: s.goalProgress.filter((l) => l.goalId !== id) }));
    },

    async deleteAsset(id) {
      const asset = get().assets.find((a) => a.id === id);
      if (!asset || asset.system) return;
      if (asset.blobKey) {
        forgetFileUrl(asset.blobKey);
        await localFiles.remove(asset.blobKey);
      }
      commit((s) => ({
        assets: s.assets.filter((a) => a.id !== id),
        projects: s.projects.map((p) =>
          p.assetIds.includes(id) || p.publication.coverAssetId === id || p.publication.thumbnailAssetId === id
            ? {
                ...p,
                assetIds: p.assetIds.filter((x) => x !== id),
                publication: {
                  ...p.publication,
                  coverAssetId: p.publication.coverAssetId === id ? undefined : p.publication.coverAssetId,
                  thumbnailAssetId: p.publication.thumbnailAssetId === id ? undefined : p.publication.thumbnailAssetId,
                },
              }
            : p,
        ),
        references: s.references.map((r) => (r.assetId === id ? { ...r, assetId: undefined } : r)),
        brandFonts: s.brandFonts.map((f) => (f.assetId === id ? { ...f, assetId: undefined } : f)),
        brand: {
          ...s.brand,
          logoAssetId: s.brand.logoAssetId === id ? undefined : s.brand.logoAssetId,
          symbolAssetId: s.brand.symbolAssetId === id ? undefined : s.brand.symbolAssetId,
        },
        settings:
          s.settings.profile.avatarAssetId === id
            ? { ...s.settings, profile: { ...s.settings.profile, avatarAssetId: undefined } }
            : s.settings,
      }));
    },

    deleteFolder(id) {
      commit((s) => ({
        folders: s.folders.filter((f) => f.id !== id),
        assets: s.assets.map((a) => (a.folderId === id ? { ...a, folderId: undefined } : a)),
      }));
    },

    deletePalette(id) {
      commit((s) => ({ palettes: s.palettes.filter((p) => p.id !== id), colors: s.colors.filter((c) => c.paletteId !== id) }));
    },

    linkAsset(assetId, projectId, linked) {
      commit((s) => ({
        assets: s.assets.map((a) =>
          a.id === assetId
            ? {
                ...a,
                projectIds: linked
                  ? Array.from(new Set([...a.projectIds, projectId]))
                  : a.projectIds.filter((x) => x !== projectId),
              }
            : a,
        ),
        projects: s.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                assetIds: linked ? Array.from(new Set([...p.assetIds, assetId])) : p.assetIds.filter((x) => x !== assetId),
              }
            : p,
        ),
      }));
    },

    markReminder(key) {
      commit((s) => {
        const fired = { ...s.firedReminders, [key]: Date.now() };
        // Keep the log small: drop entries older than 30 days.
        const cutoff = Date.now() - 30 * 864e5;
        for (const k of Object.keys(fired)) if (fired[k]! < cutoff) delete fired[k];
        return { firedReminders: fired };
      });
    },

    loadSample(sample) {
      commit((s) => {
        const out: Partial<DB> = {};
        for (const key of Object.keys(sample) as Collection[]) {
          const incoming = (sample[key] as { id: string }[] | undefined) ?? [];
          (out as Record<string, unknown>)[key] = [...incoming, ...(s[key] as { id: string }[])];
        }
        return out;
      });
    },

    clearSample() {
      commit((s) => {
        const keep = <T extends { demo?: boolean }>(arr: T[]) => arr.filter((r) => !r.demo);
        const projects = keep(s.projects);
        const projectIds = new Set(projects.map((p) => p.id));
        const habits = keep(s.habits);
        const habitIds = new Set(habits.map((h) => h.id));
        const goals = keep(s.goals);
        const goalIds = new Set(goals.map((g) => g.id));
        return {
          ideas: keep(s.ideas).map((i) => (i.projectId && !projectIds.has(i.projectId) ? { ...i, projectId: undefined } : i)),
          projects,
          tasks: keep(s.tasks).map((t) => (t.projectId && !projectIds.has(t.projectId) ? { ...t, projectId: undefined } : t)),
          habits,
          habitLogs: s.habitLogs.filter((l) => habitIds.has(l.habitId)),
          goals,
          goalProgress: s.goalProgress.filter((p) => goalIds.has(p.goalId)),
          timeLogs: keep(s.timeLogs),
          events: keep(s.events),
          analytics: keep(s.analytics),
          references: keep(s.references),
          combos: s.combos,
          assets: s.assets.map((a) => ({ ...a, projectIds: a.projectIds.filter((id) => projectIds.has(id)) })),
        };
      });
    },

    replaceAll(db) {
      set((s) => ({ ...migrate(db), rev: s.rev + 1 }));
    },

    async resetAll() {
      await localData.clear();
      set((s) => ({ ...freshDB(), rev: s.rev + 1 }));
    },
  };
});

/* ── Hydration + save loop ─────────────────────────────────── */
const DATA_KEYS: (keyof DB)[] = [
  'version', 'ideas', 'projects', 'tasks', 'habits', 'habitLogs', 'goals', 'goalProgress', 'timeLogs',
  'events', 'analytics', 'assets', 'folders', 'palettes', 'colors', 'combos', 'references', 'brandFonts', 'brand', 'settings', 'firedReminders',
];

export function snapshot(s: Store = useStore.getState()): DB {
  const out = {} as Record<string, unknown>;
  for (const k of DATA_KEYS) out[k] = s[k];
  return out as unknown as DB;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemote = false;

/** Write any pending change immediately (used when the page is being hidden or closed). */
export function flushPendingSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    void flush();
  }
}

async function flush() {
  saveTimer = null;
  const s = useStore.getState();
  try {
    await localData.save(snapshot(s));
    useStore.setState({ saveState: 'saved', lastSavedAt: Date.now() });
    announceSave(s.rev);
  } catch (e) {
    console.error('[creator-os] save failed', e);
    useStore.setState({ saveState: 'error' });
  }
}

export async function initStore() {
  const stored = await localData.load();
  const db = stored ? migrate(stored) : freshDB();
  useStore.setState({ ...db, hydrated: true, saveState: stored ? 'saved' : 'idle' });
  if (!stored) await localData.save(db);

  useStore.subscribe((s, prev) => {
    if (s.rev === prev.rev || applyingRemote) return;
    if (s.saveState !== 'saving') useStore.setState({ saveState: 'saving' });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 250);
  });

  const flushNow = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      void flush();
    }
  };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushNow());

  onRemoteSave(async () => {
    const remote = await localData.load();
    if (!remote) return;
    applyingRemote = true;
    useStore.setState({ ...migrate(remote) });
    applyingRemote = false;
  });
}
