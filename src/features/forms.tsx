import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { ArrowRightCircle, Copy, Plus, Star, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Checkbox, ChipToggle, Field, Input, Segmented, Select, TagInput, Textarea, Button } from '@/components/ui';
import { Modal } from '@/components/overlay';
import {
  EVENT_TYPES,
  FORMATS,
  GOAL_METRICS,
  GOAL_PERIODS,
  HABIT_COLORS,
  IDEA_STATUSES,
  PRIORITIES,
  RECURRENCES,
  REFERENCE_KINDS,
  REMINDER_OPTIONS,
  STAGES,
  TASK_CATEGORIES,
  WEEKDAYS_SHORT,
  WORK_ACTIVITIES,
} from '@/lib/constants';
import {
  newAnalytics,
  newColor,
  newCombo,
  newEvent,
  newGoal,
  newHabit,
  newIdea,
  newProject,
  newReference,
  newTask,
  newTimeLog,
} from '@/lib/factories';
import { goalValue } from '@/lib/metrics';
import { snapshot, useStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import type {
  AnalyticsRecord,
  CalendarEvent,
  ContentProject,
  Goal,
  GoalPeriod,
  Habit,
  Idea,
  Priority,
  Task,
} from '@/lib/types';
import { closeModal, confirmDialog, openModal, toast } from '@/lib/ui';
import { contrastRatio, fmtDate, isHex, normalizeHex, readableOn, toDateStr, todayStr, uid } from '@/lib/utils';

/* ── tiny form state helper ── */
function useFormState<T extends object>(initial: T) {
  const [v, setV] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const set = <K extends keyof T>(k: K, val: T[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  return { v, set, setV, errors, setErrors };
}

const priorityOptions = PRIORITIES.slice().reverse().map((p) => ({ value: p.id, label: p.label }));
const usePlatformOptions = () => {
  const platforms = useStore((s) => s.settings.platforms);
  return platforms.map((p) => ({ value: p.id, label: p.name, color: p.color }));
};
const useProjectOptions = () => {
  const projects = useStore((s) => s.projects);
  return projects.map((p) => ({ value: p.id, label: p.title || 'Untitled video' }));
};

function Foot({ children, onDelete, deleteLabel = 'Delete' }: { children: ReactNode; onDelete?: () => void; deleteLabel?: string }) {
  return (
    <>
      {onDelete && (
        <Button variant="danger-ghost" icon={<Trash2 />} onClick={onDelete}>
          {deleteLabel}
        </Button>
      )}
      <span className="spacer" />
      {children}
    </>
  );
}

async function confirmDelete(what: string) {
  return confirmDialog({ title: `Delete ${what}?`, description: `“${what}” will be permanently removed.`, confirmLabel: 'Delete' });
}

/* ════════════════════════ Idea ════════════════════════ */
export function IdeaModal({ id, defaults }: { id?: string; defaults?: Partial<Idea> }) {
  const existing = useStore((s) => (id ? s.ideas.find((i) => i.id === id) : undefined));
  const categories = useStore((s) => s.settings.ideaCategories);
  const allTags = useStore(useShallow((s) => Array.from(new Set(s.ideas.flatMap((i) => i.tags)))));
  const { insert, update, remove, duplicateIdea } = useStore.getState();
  const platformOptions = usePlatformOptions();
  const navigate = useNavigate();
  const { v, set, errors, setErrors } = useFormState<Idea>(existing ?? newIdea({ category: categories[0] ?? 'Other', ...defaults }));

  const save = (thenConvert = false) => {
    if (!v.title.trim()) return setErrors({ title: 'Give the idea a short title.' });
    const rec = { ...v, title: v.title.trim() };
    if (existing) update('ideas', existing.id, rec);
    else insert('ideas', rec);
    closeModal();
    if (thenConvert) {
      const p = useStore.getState().convertIdea(rec.id);
      if (p) {
        toast('Idea converted to a video project', { description: 'Opened in Content Studio.' });
        navigate(`/studio/${p.id}`);
      }
      return;
    }
    toast(existing ? 'Idea updated' : 'Idea captured', { description: rec.title });
  };

  return (
    <Modal
      open
      onClose={closeModal}
      size="lg"
      title={existing ? 'Edit idea' : 'New idea'}
      description={existing ? `Captured ${fmtDate(existing.createdAt, 'd MMM yyyy')}` : 'Your second brain. Capture now, shape later.'}
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(existing.title)) {
                    remove('ideas', existing.id);
                    closeModal();
                    toast('Idea deleted');
                  }
                }
              : undefined
          }
        >
          {existing && (
            <Button
              variant="ghost"
              icon={<Copy />}
              onClick={() => {
                duplicateIdea(existing.id);
                closeModal();
                toast('Idea duplicated');
              }}
            >
              Duplicate
            </Button>
          )}
          {existing?.projectId ? (
            <Button
              icon={<ArrowRightCircle />}
              onClick={() => {
                closeModal();
                navigate(`/studio/${existing.projectId}`);
              }}
            >
              Open project
            </Button>
          ) : (
            <Button icon={<ArrowRightCircle />} onClick={() => save(true)}>
              {existing ? 'Convert to content' : 'Save & convert'}
            </Button>
          )}
          <Button variant="primary" onClick={() => save()} kbd="↵">
            {existing ? 'Save' : 'Capture idea'}
          </Button>
        </Foot>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="row gap-12" style={{ alignItems: 'flex-end' }}>
          <Field label="Title" required error={errors.title} className="grow">
            <Input value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. 24h with a €100 budget in Madrid" invalid={!!errors.title} autoFocus />
          </Field>
          <Button
            iconOnly
            tip={v.favorite ? 'Remove favourite' : 'Mark favourite'}
            icon={<Star fill={v.favorite ? 'var(--lime)' : 'none'} color={v.favorite ? 'var(--lime)' : undefined} />}
            onClick={() => set('favorite', !v.favorite)}
            aria-pressed={v.favorite}
          />
        </div>
        <Field label="Description">
          <Textarea autoGrow value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="The angle, the hook, why it matters…" />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <Select value={v.category} onChange={(e) => set('category', e.target.value)} options={categories.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Format">
            <Select value={v.format} onChange={(e) => set('format', e.target.value as Idea['format'])} placeholder="Any format" options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
          </Field>
          <Field label="Status">
            <Select value={v.status} onChange={(e) => set('status', e.target.value as Idea['status'])} options={IDEA_STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
          </Field>
          <Field label="Priority">
            <Segmented label="Priority" value={v.priority} onChange={(p) => set('priority', p as Priority)} options={priorityOptions} />
          </Field>
          <Field label="Platforms" className="span-2">
            <ChipToggle options={platformOptions} value={v.platformIds} onChange={(x) => set('platformIds', x)} />
          </Field>
          <Field label="Reference or inspiration" className="span-2" hint="A link, a creator, a song — anything that sparked it.">
            <Input value={v.reference} onChange={(e) => set('reference', e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Tags" className="span-2">
            <TagInput value={v.tags} onChange={(t) => set('tags', t)} suggestions={allTags} />
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* ════════════════════════ New content project ════════════════════════ */
export function ProjectModal({ defaults }: { defaults?: Partial<ContentProject> }) {
  const settings = useStore((s) => s.settings);
  const platformOptions = usePlatformOptions();
  const navigate = useNavigate();
  const { v, set, errors, setErrors } = useFormState<ContentProject>(newProject({ category: settings.ideaCategories[0] ?? 'Other', ...defaults }, settings));
  const [mins, setMins] = useState(v.duration ? String(Math.round(v.duration / 6) / 10) : '');

  const save = () => {
    if (!v.title.trim()) return setErrors({ title: 'Every video needs a working title.' });
    const rec: ContentProject = { ...v, title: v.title.trim(), duration: mins ? Math.round(parseFloat(mins) * 60) : undefined, stageDates: { [v.stage]: new Date().toISOString() } };
    useStore.getState().insert('projects', rec);
    closeModal();
    toast('Video project created', { description: 'Your production workspace is ready.' });
    navigate(`/studio/${rec.id}`);
  };

  return (
    <Modal
      open
      onClose={closeModal}
      size="lg"
      title="New video"
      description="Set the essentials — the workspace opens next for concept, script, shots and publishing."
      footer={
        <Foot>
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Create & open workspace
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Working title" required error={errors.title}>
          <Input value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. My honest review of the new camera" invalid={!!errors.title} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea autoGrow value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this video about?" />
        </Field>
        <div className="form-grid">
          <Field label="Platforms" className="span-2">
            <ChipToggle options={platformOptions} value={v.platformIds} onChange={(x) => set('platformIds', x)} />
          </Field>
          <Field label="Format">
            <Select value={v.format} onChange={(e) => set('format', e.target.value as ContentProject['format'])} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
          </Field>
          <Field label="Category">
            <Select value={v.category} onChange={(e) => set('category', e.target.value)} options={settings.ideaCategories.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Goal of the video" className="span-2">
            <Input value={v.goal} onChange={(e) => set('goal', e.target.value)} placeholder="Grow followers, drive saves, sell, entertain…" />
          </Field>
          <Field label="Publish date">
            <Input type="date" value={v.publishDate ?? ''} onChange={(e) => set('publishDate', e.target.value || undefined)} />
          </Field>
          <Field label="Publish time">
            <Input type="time" value={v.publishTime ?? ''} onChange={(e) => set('publishTime', e.target.value || undefined)} />
          </Field>
          <Field label="Estimated duration (min)">
            <Input type="number" min={0} step={0.5} value={mins} onChange={(e) => setMins(e.target.value)} placeholder="1" />
          </Field>
          <Field label="Stage">
            <Select value={v.stage} onChange={(e) => set('stage', e.target.value as ContentProject['stage'])} options={STAGES.map((s) => ({ value: s.id, label: s.label }))} />
          </Field>
          <Field label="Priority" className="span-2">
            <Segmented label="Priority" value={v.priority} onChange={(p) => set('priority', p as Priority)} options={priorityOptions} />
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* ════════════════════════ Task ════════════════════════ */
export function TaskModal({ id, defaults }: { id?: string; defaults?: Partial<Task> }) {
  const existing = useStore((s) => (id ? s.tasks.find((t) => t.id === id) : undefined));
  const projectOptions = useProjectOptions();
  const { v, set, errors, setErrors } = useFormState<Task>(existing ?? newTask(defaults));
  const [sub, setSub] = useState('');
  const store = useStore.getState();

  const save = () => {
    if (!v.title.trim()) return setErrors({ title: 'What needs to be done?' });
    if (v.reminder !== null && !v.dueDate) return setErrors({ reminder: 'Set a due date to receive a reminder.' } as never);
    const rec = { ...v, title: v.title.trim() };
    if (existing) {
      // Completing through the form behaves like the checkbox (handles recurrence).
      const wasDone = existing.status === 'done';
      const isDone = rec.status === 'done';
      store.update('tasks', existing.id, { ...rec, status: existing.status });
      if (wasDone !== isDone) store.toggleTask(existing.id);
      else if (rec.status !== existing.status) store.update('tasks', existing.id, { status: rec.status });
    } else {
      store.insert('tasks', { ...rec, completedAt: rec.status === 'done' ? new Date().toISOString() : undefined });
    }
    closeModal();
    toast(existing ? 'Task updated' : 'Task added', { description: rec.title });
  };

  const addSub = () => {
    if (!sub.trim()) return;
    set('subtasks', [...v.subtasks, { id: uid(), title: sub.trim(), done: false }]);
    setSub('');
  };

  return (
    <Modal
      open
      onClose={closeModal}
      size="lg"
      title={existing ? 'Edit task' : 'New task'}
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(existing.title)) {
                    store.remove('tasks', existing.id);
                    closeModal();
                    toast('Task deleted');
                  }
                }
              : undefined
          }
        >
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {existing ? 'Save task' : 'Add task'}
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Task" required error={errors.title}>
          <Input value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Send invoice to the brand" invalid={!!errors.title} autoFocus />
        </Field>
        <Field label="Notes">
          <Textarea autoGrow value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="Details, links, context…" style={{ minHeight: 64 }} />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <Select value={v.category} onChange={(e) => set('category', e.target.value as Task['category'])} options={TASK_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          </Field>
          <Field label="Status">
            <Select
              value={v.status}
              onChange={(e) => set('status', e.target.value as Task['status'])}
              options={[
                { value: 'todo', label: 'To do' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'done', label: 'Done' },
              ]}
            />
          </Field>
          <Field label="Due date">
            <Input type="date" value={v.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || undefined)} />
          </Field>
          <Field label="Time">
            <Input type="time" value={v.dueTime ?? ''} onChange={(e) => set('dueTime', e.target.value || undefined)} disabled={!v.dueDate} />
          </Field>
          <Field label="Repeat">
            <Select value={v.recurrence} onChange={(e) => set('recurrence', e.target.value as Task['recurrence'])} options={RECURRENCES.map((r) => ({ value: r.id, label: r.label }))} />
          </Field>
          <Field label="Reminder" error={(errors as Record<string, string>).reminder}>
            <Select
              value={v.reminder === null ? '' : String(v.reminder)}
              onChange={(e) => set('reminder', e.target.value === '' ? null : Number(e.target.value))}
              options={REMINDER_OPTIONS.filter((r) => r.value !== null).map((r) => ({ value: String(r.value), label: r.label }))}
              placeholder="No reminder"
            />
          </Field>
          <Field label="Related video">
            <Select value={v.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || undefined)} options={projectOptions} placeholder="None" />
          </Field>
          <Field label="Priority">
            <Segmented label="Priority" value={v.priority} onChange={(p) => set('priority', p as Priority)} options={priorityOptions} />
          </Field>
          <div className="span-2 row between" style={{ padding: '4px 0' }}>
            <span className="field__label">Add to My Day</span>
            <Checkbox checked={v.myDay === todayStr()} onChange={(c) => set('myDay', c ? todayStr() : undefined)} label="Add to My Day" />
          </div>
        </div>
        <Field label={`Subtasks${v.subtasks.length ? ` · ${v.subtasks.filter((s) => s.done).length}/${v.subtasks.length}` : ''}`}>
          <div className="col" style={{ gap: 6 }}>
            {v.subtasks.map((s) => (
              <div key={s.id} className="row subtask-row">
                <Checkbox sm checked={s.done} onChange={(c) => set('subtasks', v.subtasks.map((x) => (x.id === s.id ? { ...x, done: c } : x)))} label={s.title} />
                <input className="input input--sm grow" value={s.title} onChange={(e) => set('subtasks', v.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} aria-label="Subtask" />
                <Button variant="ghost" size="sm" iconOnly icon={<X />} onClick={() => set('subtasks', v.subtasks.filter((x) => x.id !== s.id))} aria-label="Remove subtask" />
              </div>
            ))}
            <div className="row">
              <Input sm value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Add a subtask and press Enter" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSub())} />
              <Button size="sm" icon={<Plus />} onClick={addSub}>
                Add
              </Button>
            </div>
          </div>
        </Field>
      </form>
    </Modal>
  );
}

/* ════════════════════════ Habit ════════════════════════ */
export function HabitModal({ id }: { id?: string }) {
  const existing = useStore((s) => (id ? s.habits.find((h) => h.id === id) : undefined));
  const { v, set, errors, setErrors } = useFormState<Habit>(existing ?? newHabit());
  const store = useStore.getState();
  const save = () => {
    if (!v.name.trim()) return setErrors({ name: 'Name your habit.' });
    if (v.frequency === 'custom' && !v.days.length) return setErrors({ days: 'Pick at least one day.' } as never);
    const rec = { ...v, name: v.name.trim(), target: v.frequency === 'weekly' ? Math.max(1, Math.min(7, v.target)) : 1 };
    if (existing) store.update('habits', existing.id, rec);
    else store.insert('habits', rec);
    closeModal();
    toast(existing ? 'Habit updated' : 'Habit created', { description: rec.name });
  };
  return (
    <Modal
      open
      onClose={closeModal}
      title={existing ? 'Edit habit' : 'New habit'}
      description="Small, repeatable, trackable."
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(existing.name)) {
                    store.deleteHabit(existing.id);
                    closeModal();
                    toast('Habit deleted');
                  }
                }
              : undefined
          }
        >
          {existing && (
            <Button
              variant="ghost"
              onClick={() => {
                store.update('habits', existing.id, { archived: !existing.archived });
                closeModal();
                toast(existing.archived ? 'Habit restored' : 'Habit archived');
              }}
            >
              {existing.archived ? 'Restore' : 'Archive'}
            </Button>
          )}
          <Button variant="primary" onClick={save}>
            {existing ? 'Save habit' : 'Create habit'}
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Habit" required error={errors.name}>
          <Input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Record content" invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Why it matters">
          <Input value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Frequency">
          <Segmented
            label="Frequency"
            value={v.frequency}
            onChange={(f) => set('frequency', f as Habit['frequency'])}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekdays', label: 'Weekdays' },
              { value: 'custom', label: 'Custom days' },
              { value: 'weekly', label: 'X / week' },
            ]}
          />
        </Field>
        {v.frequency === 'custom' && (
          <Field label="On these days" error={(errors as Record<string, string>).days}>
            <ChipToggle options={WEEKDAYS_SHORT.map((d, i) => ({ value: String(i), label: d }))} value={v.days.map(String)} onChange={(x) => set('days', x.map(Number).sort())} />
          </Field>
        )}
        {v.frequency === 'weekly' && (
          <Field label="Times per week">
            <Input type="number" min={1} max={7} value={v.target} onChange={(e) => set('target', Number(e.target.value) || 1)} />
          </Field>
        )}
        <div className="form-grid">
          <Field label="Reminder time" hint="Shown in Today and as a notification.">
            <Input type="time" value={v.reminderTime ?? ''} onChange={(e) => set('reminderTime', e.target.value || undefined)} />
          </Field>
          <Field label="Colour">
            <div className="chips">
              {HABIT_COLORS.map((c) => (
                <button key={c} type="button" className="swatch-btn" aria-pressed={v.color === c} style={{ background: c }} onClick={() => set('color', c)} aria-label={`Colour ${c}`} />
              ))}
            </div>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/* ════════════════════════ Goal ════════════════════════ */
function periodRange(period: GoalPeriod, weekStartsOn: 0 | 1): [string, string] {
  const now = new Date();
  switch (period) {
    case 'daily':
      return [todayStr(), todayStr()];
    case 'weekly': {
      const e = endOfWeek(now, { weekStartsOn });
      const s = new Date(e);
      s.setDate(e.getDate() - 6);
      return [toDateStr(s), toDateStr(e)];
    }
    case 'monthly':
      return [toDateStr(startOfMonth(now)), toDateStr(endOfMonth(now))];
    case 'yearly':
      return [toDateStr(startOfYear(now)), toDateStr(endOfYear(now))];
  }
}

export function GoalModal({ id }: { id?: string }) {
  const existing = useStore((s) => (id ? s.goals.find((g) => g.id === id) : undefined));
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const platformOptions = usePlatformOptions();
  const init = useMemo(() => {
    if (existing) return existing;
    const [startDate, dueDate] = periodRange('monthly', weekStartsOn);
    return newGoal({ startDate, dueDate, metric: 'videos_published', unit: 'videos', target: 12 });
  }, [existing, weekStartsOn]);
  const { v, set, setV, errors, setErrors } = useFormState<Goal>(init);
  const store = useStore.getState();
  const metric = GOAL_METRICS.find((m) => m.id === v.metric)!;

  const save = () => {
    const e: Partial<Record<keyof Goal, string>> = {};
    if (!v.title.trim()) e.title = 'Describe the goal.';
    if (!(v.target > 0)) e.target = 'Target must be greater than 0.';
    if (v.dueDate < v.startDate) e.dueDate = 'Due date must be after the start date.';
    if (Object.keys(e).length) return setErrors(e);
    const rec = { ...v, title: v.title.trim() };
    if (existing) store.update('goals', existing.id, rec);
    else store.insert('goals', rec);
    closeModal();
    toast(existing ? 'Goal updated' : 'Goal set', { description: rec.title });
  };

  return (
    <Modal
      open
      onClose={closeModal}
      size="lg"
      title={existing ? 'Edit goal' : 'New goal'}
      description="Automatic goals measure themselves from your real activity."
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(existing.title)) {
                    store.deleteGoal(existing.id);
                    closeModal();
                    toast('Goal deleted');
                  }
                }
              : undefined
          }
        >
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {existing ? 'Save goal' : 'Set goal'}
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Goal" required error={errors.title}>
          <Input value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Publish 12 videos this month" invalid={!!errors.title} autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Period">
            <Select
              value={v.period}
              onChange={(e) => {
                const period = e.target.value as GoalPeriod;
                const [startDate, dueDate] = periodRange(period, weekStartsOn);
                setV((p) => ({ ...p, period, startDate, dueDate }));
              }}
              options={GOAL_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
            />
          </Field>
          <Field label="How progress is measured">
            <Select
              value={v.metric}
              onChange={(e) => {
                const m = GOAL_METRICS.find((x) => x.id === e.target.value)!;
                setV((p) => ({ ...p, metric: m.id, unit: m.unit || p.unit }));
              }}
              options={GOAL_METRICS.map((m) => ({ value: m.id, label: m.label }))}
            />
          </Field>
          {(v.metric === 'videos_published' || v.metric === 'videos_produced' || v.metric === 'followers_gained') && (
            <Field label="Platform" className="span-2">
              <Select value={v.platformId ?? ''} onChange={(e) => set('platformId', e.target.value || undefined)} options={platformOptions.map((p) => ({ value: p.value, label: p.label }))} placeholder="All platforms" />
            </Field>
          )}
          <Field label="Target" required error={errors.target}>
            <Input type="number" min={0} step="any" value={v.target} onChange={(e) => set('target', Number(e.target.value))} invalid={!!errors.target} />
          </Field>
          <Field label="Unit">
            <Input value={v.unit} onChange={(e) => set('unit', e.target.value)} placeholder="videos, followers, hours…" disabled={metric.auto} />
          </Field>
          <Field label="Start">
            <Input type="date" value={v.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Target date" error={errors.dueDate}>
            <Input type="date" value={v.dueDate} onChange={(e) => set('dueDate', e.target.value)} invalid={!!errors.dueDate} />
          </Field>
          <Field label="Status">
            <Select
              value={v.status}
              onChange={(e) => set('status', e.target.value as Goal['status'])}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'achieved', label: 'Achieved' },
                { value: 'paused', label: 'Paused' },
                { value: 'missed', label: 'Missed' },
              ]}
            />
          </Field>
          <Field label="Notes" className="span-2">
            <Textarea value={v.description} onChange={(e) => set('description', e.target.value)} style={{ minHeight: 64 }} placeholder="Why this goal, how you’ll get there…" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function GoalProgressModal({ goalId }: { goalId: string }) {
  const goal = useStore((s) => s.goals.find((g) => g.id === goalId));
  const entries = useStore(useShallow((s) => s.goalProgress.filter((p) => p.goalId === goalId).sort((a, b) => b.date.localeCompare(a.date))));
  const state = useStore();
  const [value, setValue] = useState('1');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  if (!goal) return null;
  const cur = goalValue(snapshot(state), goal);
  const add = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return toast('Enter a non-zero amount', { tone: 'error' });
    state.insert('goalProgress', { id: uid(), goalId, date, value: n, note: note.trim(), createdAt: new Date().toISOString() });
    setNote('');
    toast('Progress logged', { description: `${n > 0 ? '+' : ''}${n} ${goal.unit}` });
  };
  return (
    <Modal open onClose={closeModal} title="Log progress" description={`${goal.title} · ${cur.value} / ${goal.target} ${goal.unit}`} footer={<Button variant="primary" onClick={closeModal}>Done</Button>}>
      <div className="form">
        <div className="form-grid">
          <Field label="Amount" hint="Use a negative number to correct.">
            <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note" className="span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" onKeyDown={(e) => e.key === 'Enter' && add()} />
          </Field>
        </div>
        <Button variant="lime" icon={<Plus />} onClick={add}>
          Add progress
        </Button>
        {entries.length > 0 && (
          <div className="col" style={{ gap: 2 }}>
            <div className="eyebrow" style={{ margin: '6px 0' }}>History</div>
            {entries.map((e) => (
              <div key={e.id} className="row between list-row">
                <span className="tnum" style={{ fontWeight: 600, minWidth: 54 }}>{e.value > 0 ? `+${e.value}` : e.value}</span>
                <span className="grow subtle truncate">{e.note || '—'}</span>
                <span className="subtle tnum">{fmtDate(e.date, 'd MMM')}</span>
                <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => state.remove('goalProgress', e.id)} aria-label="Delete entry" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ════════════════════════ Calendar event ════════════════════════ */
export function EventModal({ id, defaults }: { id?: string; defaults?: Partial<CalendarEvent> }) {
  const existing = useStore((s) => (id ? s.events.find((e) => e.id === id) : undefined));
  const projectOptions = useProjectOptions();
  const { v, set, errors, setErrors } = useFormState<CalendarEvent>(existing ?? newEvent(defaults));
  const store = useStore.getState();
  const save = () => {
    const e: Partial<Record<keyof CalendarEvent, string>> = {};
    if (!v.title.trim()) e.title = 'Add a title.';
    if (!v.date) e.date = 'Pick a date.';
    if (v.startTime && v.endTime && v.endTime <= v.startTime) e.endTime = 'End must be after start.';
    if (v.reminder !== null && !v.startTime) e.reminder = 'Reminders need a start time.';
    if (Object.keys(e).length) return setErrors(e);
    const rec = { ...v, title: v.title.trim() };
    if (existing) store.update('events', existing.id, rec);
    else store.insert('events', rec);
    closeModal();
    toast(existing ? 'Event updated' : 'Event added', { description: `${rec.title} · ${fmtDate(rec.date, 'EEE d MMM')}` });
  };
  return (
    <Modal
      open
      onClose={closeModal}
      title={existing ? 'Edit event' : 'New event'}
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(existing.title)) {
                    store.remove('events', existing.id);
                    closeModal();
                    toast('Event deleted');
                  }
                }
              : undefined
          }
        >
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {existing ? 'Save event' : 'Add event'}
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Title" required error={errors.title}>
          <Input value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Shoot day — city vlog" invalid={!!errors.title} autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Type">
            <Select value={v.type} onChange={(e) => set('type', e.target.value as CalendarEvent['type'])} options={EVENT_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          </Field>
          <Field label="Date" required error={errors.date}>
            <Input type="date" value={v.date} onChange={(e) => set('date', e.target.value)} invalid={!!errors.date} />
          </Field>
          <Field label="Starts">
            <Input type="time" value={v.startTime ?? ''} onChange={(e) => set('startTime', e.target.value || undefined)} />
          </Field>
          <Field label="Ends" error={errors.endTime}>
            <Input type="time" value={v.endTime ?? ''} onChange={(e) => set('endTime', e.target.value || undefined)} invalid={!!errors.endTime} />
          </Field>
          <Field label="Related video">
            <Select value={v.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || undefined)} options={projectOptions} placeholder="None" />
          </Field>
          <Field label="Reminder" error={errors.reminder}>
            <Select
              value={v.reminder === null ? '' : String(v.reminder)}
              onChange={(e) => set('reminder', e.target.value === '' ? null : Number(e.target.value))}
              options={REMINDER_OPTIONS.filter((r) => r.value !== null).map((r) => ({ value: String(r.value), label: r.label }))}
              placeholder="No reminder"
            />
          </Field>
          <Field label="Notes" className="span-2">
            <Textarea value={v.notes} onChange={(e) => set('notes', e.target.value)} style={{ minHeight: 64 }} placeholder="Location, gear, people…" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/* ════════════════════════ Analytics record ════════════════════════ */
const METRIC_FIELDS: { key: keyof AnalyticsRecord; label: string }[] = [
  { key: 'views', label: 'Views' },
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'followersGained', label: 'Followers gained' },
];

export function StatsModal({ id, defaults }: { id?: string; defaults?: Partial<AnalyticsRecord> }) {
  const existing = useStore((s) => (id ? s.analytics.find((a) => a.id === id) : undefined));
  const projects = useStore((s) => s.projects);
  const categories = useStore((s) => s.settings.ideaCategories);
  const platformOptions = usePlatformOptions();
  const init = useMemo(() => {
    if (existing) return existing;
    const base = newAnalytics(defaults);
    const p = defaults?.projectId ? projects.find((x) => x.id === defaults.projectId) : undefined;
    if (p)
      return {
        ...base,
        title: p.title,
        category: p.category,
        format: p.format,
        platformId: defaults?.platformId ?? p.platformIds[0] ?? base.platformId,
        publishedDate: p.publishDate ?? base.publishedDate,
      };
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { v, set, setV, errors, setErrors } = useFormState<AnalyticsRecord>(init);
  const store = useStore.getState();

  const pickProject = (pid: string) => {
    const p = projects.find((x) => x.id === pid);
    if (!p) return set('projectId', undefined);
    setV((prev) => ({ ...prev, projectId: p.id, title: p.title, category: p.category, format: p.format, platformId: p.platformIds[0] ?? prev.platformId, publishedDate: p.publishDate ?? prev.publishedDate }));
  };

  const save = () => {
    const e: Partial<Record<keyof AnalyticsRecord, string>> = {};
    if (!v.title.trim()) e.title = 'Which post are these numbers for?';
    for (const f of METRIC_FIELDS) if ((v[f.key] as number) < 0) e[f.key] = 'Cannot be negative.';
    if (Object.keys(e).length) return setErrors(e);
    if (existing) store.update('analytics', existing.id, v);
    else store.insert('analytics', v);
    closeModal();
    toast(existing ? 'Statistics updated' : 'Statistics recorded', { description: v.title });
  };

  return (
    <Modal
      open
      onClose={closeModal}
      size="lg"
      title={existing ? 'Edit statistics' : 'Log statistics'}
      description="Manual entry — no platform API is connected, so numbers come from your app’s insights."
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(`stats for ${existing.title}`)) {
                    store.remove('analytics', existing.id);
                    closeModal();
                    toast('Record deleted');
                  }
                }
              : undefined
          }
        >
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save statistics
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <div className="form-grid">
          <Field label="Video from Content Studio" className="span-2" hint="Optional — or type a title for posts you don’t track here.">
            <Select value={v.projectId ?? ''} onChange={(e) => pickProject(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.title || 'Untitled' }))} placeholder="Not linked" />
          </Field>
          <Field label="Post title" required error={errors.title} className="span-2">
            <Input value={v.title} onChange={(e) => set('title', e.target.value)} invalid={!!errors.title} />
          </Field>
          <Field label="Platform">
            <Select value={v.platformId} onChange={(e) => set('platformId', e.target.value)} options={platformOptions.map((p) => ({ value: p.value, label: p.label }))} />
          </Field>
          <Field label="Published on">
            <Input type="date" value={v.publishedDate} onChange={(e) => set('publishedDate', e.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={v.category} onChange={(e) => set('category', e.target.value)} options={categories.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Format">
            <Select value={v.format} onChange={(e) => set('format', e.target.value as AnalyticsRecord['format'])} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
          </Field>
        </div>
        <div className="metric-grid">
          {METRIC_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} error={errors[f.key]}>
              <Input type="number" min={0} inputMode="numeric" value={String(v[f.key] ?? 0)} onChange={(e) => set(f.key, Math.max(0, Number(e.target.value) || 0) as never)} onFocus={(e) => e.target.select()} />
            </Field>
          ))}
        </div>
      </form>
    </Modal>
  );
}

/* ════════════════════════ Time log ════════════════════════ */
export function TimeLogModal({ id, defaults }: { id?: string; defaults?: { projectId?: string; minutes?: number; activity?: string } }) {
  const existing = useStore((s) => (id ? s.timeLogs.find((t) => t.id === id) : undefined));
  const projectOptions = useProjectOptions();
  const { v, set } = useFormState(existing ?? newTimeLog({ projectId: defaults?.projectId, minutes: defaults?.minutes ?? 60, activity: (defaults?.activity as never) ?? 'editing' }));
  const [h, setH] = useState(String(Math.floor(v.minutes / 60)));
  const [m, setM] = useState(String(v.minutes % 60));
  const store = useStore.getState();
  const save = () => {
    const minutes = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (minutes <= 0) return toast('Log at least one minute', { tone: 'error' });
    const rec = { ...v, minutes };
    if (existing) store.update('timeLogs', existing.id, rec);
    else store.insert('timeLogs', rec);
    closeModal();
    toast('Time logged', { description: `${Math.floor(minutes / 60)}h ${minutes % 60}m · ${rec.activity}` });
  };
  return (
    <Modal
      open
      onClose={closeModal}
      size="sm"
      title={existing ? 'Edit time entry' : 'Log time'}
      footer={
        <Foot
          onDelete={
            existing
              ? () => {
                  store.remove('timeLogs', existing.id);
                  closeModal();
                  toast('Entry deleted');
                }
              : undefined
          }
        >
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <div className="form-grid">
          <Field label="Hours">
            <Input type="number" min={0} value={h} onChange={(e) => setH(e.target.value)} autoFocus />
          </Field>
          <Field label="Minutes">
            <Input type="number" min={0} max={59} value={m} onChange={(e) => setM(e.target.value)} />
          </Field>
          <Field label="Activity">
            <Select value={v.activity} onChange={(e) => set('activity', e.target.value as never)} options={WORK_ACTIVITIES.map((a) => ({ value: a.id, label: a.label }))} />
          </Field>
          <Field label="Date">
            <Input type="date" value={v.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Video" className="span-2">
            <Select value={v.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || undefined)} options={projectOptions} placeholder="None" />
          </Field>
          <Field label="Note" className="span-2">
            <Input value={v.note} onChange={(e) => set('note', e.target.value)} placeholder="Optional" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/* ════════════════════════ Brand colours ════════════════════════ */
export function ColorModal({ id, paletteId }: { id?: string; paletteId?: string }) {
  const existing = useStore((s) => (id ? s.colors.find((c) => c.id === id) : undefined));
  const palettes = useStore((s) => s.palettes);
  const { v, set, errors, setErrors } = useFormState(existing ?? newColor({ paletteId: paletteId ?? palettes[0]?.id ?? '' }));
  const store = useStore.getState();
  const save = () => {
    const e: Record<string, string> = {};
    if (!v.name.trim()) e.name = 'Name the colour.';
    if (!isHex(v.hex)) e.hex = 'Use a HEX value like #2F5BFF.';
    if (!v.paletteId) e.paletteId = 'Create a palette first.';
    if (Object.keys(e).length) return setErrors(e as never);
    const rec = { ...v, name: v.name.trim(), hex: normalizeHex(v.hex) };
    if (existing) store.update('colors', existing.id, rec);
    else store.insert('colors', rec);
    closeModal();
    toast(existing ? 'Colour updated' : 'Colour added', { description: `${rec.name} ${rec.hex}` });
  };
  return (
    <Modal
      open
      onClose={closeModal}
      size="sm"
      title={existing ? 'Edit colour' : 'Add colour'}
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(existing.name)) {
                    store.remove('colors', existing.id);
                    closeModal();
                    toast('Colour removed');
                  }
                }
              : undefined
          }
        >
          <Button variant="primary" onClick={save}>
            Save colour
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <div className="color-preview" style={{ background: isHex(v.hex) ? normalizeHex(v.hex) : 'transparent', color: isHex(v.hex) ? readableOn(v.hex) : 'inherit' }}>
          <span className="display" style={{ fontSize: 26 }}>{v.name || 'Colour'}</span>
          <span className="mono">{isHex(v.hex) ? normalizeHex(v.hex) : '—'}</span>
        </div>
        <Field label="Name" required error={errors.name}>
          <Input value={v.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="HEX" required error={errors.hex}>
          <div className="row">
            <input type="color" value={isHex(v.hex) ? normalizeHex(v.hex) : '#000000'} onChange={(e) => set('hex', e.target.value.toUpperCase())} aria-label="Pick colour" />
            <Input value={v.hex} onChange={(e) => set('hex', e.target.value)} className="mono" invalid={!!errors.hex} />
          </div>
        </Field>
        <Field label="Role / usage">
          <Input value={v.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Buttons and links" />
        </Field>
        <Field label="Palette" error={(errors as Record<string, string>).paletteId}>
          <Select value={v.paletteId} onChange={(e) => set('paletteId', e.target.value)} options={palettes.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
      </form>
    </Modal>
  );
}

export function PaletteModal({ id }: { id?: string }) {
  const existing = useStore((s) => (id ? s.palettes.find((p) => p.id === id) : undefined));
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [err, setErr] = useState<string | null>(null);
  const store = useStore.getState();
  const save = () => {
    if (!name.trim()) return setErr('Name the palette.');
    if (existing) store.update('palettes', existing.id, { name: name.trim(), description });
    else store.insert('palettes', { id: uid(), name: name.trim(), description, order: Date.now() });
    closeModal();
    toast(existing ? 'Palette updated' : 'Palette created');
  };
  return (
    <Modal
      open
      onClose={closeModal}
      size="sm"
      title={existing ? 'Edit palette' : 'New palette'}
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDialog({ title: `Delete “${existing.name}”?`, description: 'All colours in this palette are removed too.' })) {
                    store.deletePalette(existing.id);
                    closeModal();
                    toast('Palette deleted');
                  }
                }
              : undefined
          }
        >
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Name" required error={err}>
          <Input value={name} onChange={(e) => (setName(e.target.value), setErr(null))} autoFocus />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use it" />
        </Field>
      </form>
    </Modal>
  );
}

export function ComboModal({ id }: { id?: string }) {
  const existing = useStore((s) => (id ? s.combos.find((c) => c.id === id) : undefined));
  const colors = useStore((s) => s.colors);
  const { v, set, errors, setErrors } = useFormState(existing ?? newCombo());
  const store = useStore.getState();
  const ratio = contrastRatio(v.background, v.foreground);
  const save = () => {
    if (!v.name.trim()) return setErrors({ name: 'Name the combination.' });
    if (!isHex(v.background) || !isHex(v.foreground) || (v.accent && !isHex(v.accent))) return toast('Use valid HEX colours', { tone: 'error' });
    const rec = { ...v, name: v.name.trim(), background: normalizeHex(v.background), foreground: normalizeHex(v.foreground), accent: v.accent ? normalizeHex(v.accent) : undefined };
    if (existing) store.update('combos', existing.id, rec);
    else store.insert('combos', rec);
    closeModal();
    toast(existing ? 'Combination updated' : 'Combination saved');
  };
  const colorSelect = (key: 'background' | 'foreground' | 'accent', label: string, optional = false) => (
    <Field label={label}>
      <div className="row">
        <input type="color" value={isHex(v[key] ?? '') ? normalizeHex(v[key]!) : '#000000'} onChange={(e) => set(key, e.target.value.toUpperCase())} aria-label={label} />
        <Select
          value={colors.find((c) => c.hex === v[key])?.hex ?? ''}
          onChange={(e) => set(key, e.target.value || (optional ? undefined : v[key]) as never)}
          options={colors.map((c) => ({ value: c.hex, label: `${c.name} ${c.hex}` }))}
          placeholder={optional ? 'None' : v[key] ?? 'Custom'}
        />
      </div>
    </Field>
  );
  return (
    <Modal
      open
      onClose={closeModal}
      title={existing ? 'Edit combination' : 'New combination'}
      footer={
        <Foot
          onDelete={
            existing
              ? () => {
                  store.remove('combos', existing.id);
                  closeModal();
                  toast('Combination removed');
                }
              : undefined
          }
        >
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <div className="combo-preview" style={{ background: v.background, color: v.foreground }}>
          <span className="display" style={{ fontSize: 30 }}>
            Aa<span style={{ color: v.accent ?? v.foreground }}>.</span>
          </span>
          <span style={{ fontSize: 13 }}>{v.name || 'Preview'}</span>
          {v.accent && <span className="combo-preview__accent" style={{ background: v.accent }} />}
        </div>
        <div className="row between">
          <span className="subtle" style={{ fontSize: 12.5 }}>Contrast ratio</span>
          <span className={ratio >= 4.5 ? 'badge badge--positive' : ratio >= 3 ? 'badge' : 'badge badge--danger'}>
            {ratio.toFixed(2)}:1 · {ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large text' : 'Fails'}
          </span>
        </div>
        <Field label="Name" required error={errors.name}>
          <Input value={v.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        {colorSelect('background', 'Background')}
        {colorSelect('foreground', 'Text')}
        {colorSelect('accent', 'Accent (optional)', true)}
        <Field label="Usage note">
          <Input value={v.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/* ════════════════════════ Visual reference ════════════════════════ */
export function ReferenceModal({ id }: { id?: string }) {
  const existing = useStore((s) => (id ? s.references.find((r) => r.id === id) : undefined));
  const assets = useStore(useShallow((s) => s.assets.filter((a) => a.mime.startsWith('image/'))));
  const { v, set, errors, setErrors } = useFormState(existing ?? newReference());
  const store = useStore.getState();
  const save = () => {
    if (!v.title.trim()) return setErrors({ title: 'Give it a title.' });
    const rec = { ...v, title: v.title.trim() };
    if (existing) store.update('references', existing.id, rec);
    else store.insert('references', rec);
    closeModal();
    toast(existing ? 'Reference updated' : 'Reference saved');
  };
  return (
    <Modal
      open
      onClose={closeModal}
      title={existing ? 'Edit reference' : 'Save a reference'}
      description="Moodboards, photography, screenshots and campaign ideas."
      footer={
        <Foot
          onDelete={
            existing
              ? async () => {
                  if (await confirmDelete(existing.title)) {
                    store.remove('references', existing.id);
                    closeModal();
                    toast('Reference removed');
                  }
                }
              : undefined
          }
        >
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </Foot>
      }
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Title" required error={errors.title}>
          <Input value={v.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Kind">
            <Select value={v.kind} onChange={(e) => set('kind', e.target.value as never)} options={REFERENCE_KINDS.map((k) => ({ value: k.id, label: k.label }))} />
          </Field>
          <Field label="Image from library">
            <Select value={v.assetId ?? ''} onChange={(e) => set('assetId', e.target.value || undefined)} options={assets.map((a) => ({ value: a.id, label: a.name }))} placeholder="None" />
          </Field>
        </div>
        <Button
          size="sm"
          icon={<Plus />}
          onClick={() => {
            const draft = { ...v, title: v.title.trim() || 'Untitled reference' };
            if (existing) store.update('references', existing.id, draft);
            else store.insert('references', draft);
            openModal({ kind: 'upload', defaults: { type: 'reference', brand: true, referenceId: draft.id } as never });
          }}
        >
          Upload a new image
        </Button>
        <Field label="Link">
          <Input value={v.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Notes">
          <Textarea value={v.notes} onChange={(e) => set('notes', e.target.value)} style={{ minHeight: 70 }} />
        </Field>
        <Field label="Tags">
          <TagInput value={v.tags} onChange={(t) => set('tags', t)} />
        </Field>
      </form>
    </Modal>
  );
}

