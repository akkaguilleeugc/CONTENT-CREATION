import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { addDays, endOfWeek } from 'date-fns';
import { Bell, CheckCheck, Clapperboard, GripVertical, ListChecks, Plus, Repeat, Sun, SunDim, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBoardSensors } from '@/components/Kanban';
import { EmptyState } from '@/components/overlay';
import { Button, Checkbox, ChipToggle, PageHeader, PriorityTag, SearchInput, Select, Tabs } from '@/components/ui';
import { TASK_CATEGORIES, priorityRank } from '@/lib/constants';
import { newTask } from '@/lib/factories';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, fmtDate, matches, relativeDay, toDateStr, todayStr } from '@/lib/utils';

type View = 'today' | 'upcoming' | 'all' | 'done';
type Sort = 'manual' | 'due' | 'priority' | 'created';

function TaskRow({ t, sortable, showDate = true }: { t: Task; sortable?: boolean; showDate?: boolean }) {
  const project = useStore((s) => (t.projectId ? s.projects.find((p) => p.id === t.projectId) : undefined));
  const sort = useSortable({ id: t.id, disabled: !sortable });
  const today = todayStr();
  const overdue = t.status !== 'done' && !!t.dueDate && t.dueDate < today;
  const store = useStore.getState();
  const subDone = t.subtasks.filter((s) => s.done).length;
  const inMyDay = t.myDay === today;

  const toggle = () => {
    const was = t.status === 'done';
    store.toggleTask(t.id);
    if (!was)
      toast(t.recurrence !== 'none' ? 'Done — next one scheduled' : 'Task completed', {
        description: t.title,
        action: t.recurrence === 'none' ? { label: 'Undo', run: () => useStore.getState().toggleTask(t.id) } : undefined,
      });
  };

  return (
    <li
      ref={sort.setNodeRef}
      style={{ transform: CSS.Transform.toString(sort.transform), transition: sort.transition }}
      className={cn('trow', t.status === 'done' && 'trow--done', sort.isDragging && 'trow--dragging')}
    >
      {sortable && (
        <button className="trow__grip" {...sort.attributes} {...sort.listeners} aria-label={`Reorder ${t.title}`}>
          <GripVertical />
        </button>
      )}
      <Checkbox round checked={t.status === 'done'} onChange={toggle} label={`Complete ${t.title}`} />
      <button className="trow__main" onClick={() => openModal({ kind: 'task', id: t.id })}>
        <span className="trow__title">{t.title}</span>
        <span className="trow__meta">
          {t.status === 'in_progress' && <span className="badge badge--accent">In progress</span>}
          {showDate && t.dueDate && (
            <span className={cn('trow__due', overdue && 'trow__due--late', t.dueDate === today && 'trow__due--today')}>
              {overdue ? `Overdue · ${relativeDay(t.dueDate)}` : relativeDay(t.dueDate)}
              {t.dueTime ? ` · ${t.dueTime}` : ''}
            </span>
          )}
          {t.subtasks.length > 0 && (
            <span className="trow__chip">
              <ListChecks /> {subDone}/{t.subtasks.length}
            </span>
          )}
          {t.recurrence !== 'none' && (
            <span className="trow__chip" title={`Repeats ${t.recurrence}`}>
              <Repeat />
            </span>
          )}
          {t.reminder !== null && (
            <span className="trow__chip" title="Reminder set">
              <Bell />
            </span>
          )}
          <span className="trow__cat">{TASK_CATEGORIES.find((c) => c.id === t.category)?.label}</span>
          {project && (
            <Link to={`/studio/${project.id}`} className="trow__project" onClick={(e) => e.stopPropagation()}>
              <Clapperboard /> <span className="truncate">{project.title}</span>
            </Link>
          )}
        </span>
      </button>
      <PriorityTag p={t.priority} label={false} />
      <span className="trow__actions">
        {t.status !== 'done' && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={inMyDay ? <SunDim /> : <Sun />}
            tip={inMyDay ? 'Remove from My Day' : 'Add to My Day'}
            onClick={() => store.update('tasks', t.id, { myDay: inMyDay ? undefined : today })}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Trash2 />}
          tip="Delete"
          onClick={() => {
            store.remove('tasks', t.id);
            toast('Task deleted', { description: t.title, action: { label: 'Undo', run: () => useStore.getState().insert('tasks', t) } });
          }}
        />
      </span>
    </li>
  );
}

function Group({ title, tasks, accent }: { title: string; tasks: Task[]; accent?: boolean }) {
  if (!tasks.length) return null;
  return (
    <section className="tgroup">
      <h3 className={cn('tgroup__title', accent && 'tgroup__title--accent')}>
        {title} <span className="count tnum">{tasks.length}</span>
      </h3>
      <ul className="tlist">
        {tasks.map((t) => (
          <TaskRow key={t.id} t={t} />
        ))}
      </ul>
    </section>
  );
}

export default function Tasks() {
  const tasks = useStore((s) => s.tasks);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const [view, setView] = useState<View>('today');
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [prio, setPrio] = useState('');
  const [sort, setSort] = useState<Sort>('manual');
  const [draft, setDraft] = useState('');
  const sensors = useBoardSensors();
  const today = todayStr();
  const store = useStore.getState();

  const base = useMemo(() => tasks.filter((t) => matches(q, t.title, t.description) && (!cats.length || cats.includes(t.category)) && (!prio || t.priority === prio)), [tasks, q, cats, prio]);
  const open = base.filter((t) => t.status !== 'done');

  const sorter = (s: Sort) => (a: Task, b: Task) => {
    if (s === 'due') return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99');
    if (s === 'priority') return priorityRank(b.priority) - priorityRank(a.priority);
    if (s === 'created') return b.createdAt.localeCompare(a.createdAt);
    return a.order - b.order;
  };

  const myDay = useMemo(() => {
    const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(sorter('due'));
    const todayList = open.filter((t) => !overdue.includes(t) && (t.dueDate === today || t.myDay === today)).sort(sorter('due'));
    const doneToday = base.filter((t) => t.status === 'done' && t.completedAt && toDateStr(new Date(t.completedAt)) === today);
    return { overdue, todayList, doneToday };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, today]);

  const upcoming = useMemo(() => {
    const tomorrow = toDateStr(addDays(new Date(), 1));
    const weekEnd = toDateStr(endOfWeek(addDays(new Date(), 1), { weekStartsOn }));
    const fut = open.filter((t) => t.dueDate && t.dueDate > today).sort(sorter('due'));
    return {
      tomorrow: fut.filter((t) => t.dueDate === tomorrow),
      week: fut.filter((t) => t.dueDate! > tomorrow && t.dueDate! <= weekEnd),
      later: fut.filter((t) => t.dueDate! > weekEnd),
      none: open.filter((t) => !t.dueDate).sort(sorter('created')),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, today, weekStartsOn]);

  const allSorted = useMemo(() => [...open].sort(sorter(sort)), [open, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = useMemo(() => base.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [base]);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    const defaults: Partial<Task> =
      view === 'today' ? { dueDate: today, myDay: today } : view === 'upcoming' ? { dueDate: toDateStr(addDays(new Date(), 1)) } : {};
    const minOrder = Math.min(0, ...tasks.map((t) => t.order));
    store.insert('tasks', newTask({ title, ...defaults, order: minOrder - 1 }));
    setDraft('');
    toast('Task added', { description: view === 'today' ? 'Due today' : view === 'upcoming' ? 'Due tomorrow' : title });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = allSorted.map((t) => t.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    store.reorderTasks(next);
  };

  const counts = {
    today: myDay.overdue.length + myDay.todayList.length,
    upcoming: upcoming.tomorrow.length + upcoming.week.length + upcoming.later.length,
    all: open.length,
    done: done.length,
  };

  const empty = (text: string) => (
    <div className="panel">
      <EmptyState icon={<CheckCheck />} title={tasks.length ? 'Nothing here' : 'No tasks yet'} text={text} actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'task', defaults: view === 'today' ? { dueDate: today, myDay: today } : {} })}>New task</Button>} />
    </div>
  );

  return (
    <div className="page tasks-page">
      <PageHeader
        title="Tasks"
        sub={tasks.length ? `${open.length} open · ${myDay.overdue.length} overdue · ${myDay.doneToday.length} completed today` : 'Personal and professional — everything you need to get done, in one list.'}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'task', defaults: view === 'today' ? { dueDate: today, myDay: today } : {} })} kbd="T">
            New task
          </Button>
        }
      />
      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { value: 'today', label: 'My Day', icon: <Sun />, count: counts.today },
          { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
          { value: 'all', label: 'All Tasks', count: counts.all },
          { value: 'done', label: 'Completed', count: counts.done },
        ]}
      />
      <div className="toolbar" style={{ marginTop: 14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search tasks…" />
        <Select sm value={prio} onChange={(e) => setPrio(e.target.value)} options={[{ value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} placeholder="Any priority" aria-label="Priority" style={{ width: 'auto' }} />
        {view === 'all' && (
          <Select
            sm
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            options={[
              { value: 'manual', label: 'Manual order (drag)' },
              { value: 'due', label: 'Due date' },
              { value: 'priority', label: 'Priority' },
              { value: 'created', label: 'Newest' },
            ]}
            aria-label="Sort"
            style={{ width: 'auto' }}
          />
        )}
        {view === 'done' && done.length > 0 && (
          <Button
            size="sm"
            variant="danger-ghost"
            icon={<Trash2 />}
            style={{ marginLeft: 'auto' }}
            onClick={async () => {
              if (await confirmDialog({ title: `Clear ${done.length} completed tasks?`, confirmLabel: 'Clear' })) {
                done.forEach((t) => store.remove('tasks', t.id));
                toast('Completed tasks cleared');
              }
            }}
          >
            Clear completed
          </Button>
        )}
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <ChipToggle sm options={TASK_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={cats} onChange={setCats} />
      </div>

      {view !== 'done' && (
        <form className="quick-add" onSubmit={(e) => (e.preventDefault(), add())}>
          <Plus size={16} />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={view === 'today' ? 'Add a task for today…' : view === 'upcoming' ? 'Add a task for tomorrow…' : 'Add a task…'} aria-label="Quick add task" />
          <span className="kbd hide-mobile">↵</span>
        </form>
      )}

      {view === 'today' &&
        (counts.today + myDay.doneToday.length === 0 ? (
          empty('Your day is clear. Add a task above or pin tasks to My Day with the sun icon.')
        ) : (
          <>
            <Group title="Overdue" tasks={myDay.overdue} />
            <Group title={`Today · ${fmtDate(today, 'EEEE d MMMM')}`} tasks={myDay.todayList} accent />
            <Group title="Completed today" tasks={myDay.doneToday} />
          </>
        ))}

      {view === 'upcoming' &&
        (counts.upcoming + upcoming.none.length === 0 ? (
          empty('No upcoming deadlines.')
        ) : (
          <>
            <Group title="Tomorrow" tasks={upcoming.tomorrow} accent />
            <Group title="Later this week" tasks={upcoming.week} />
            <Group title="Later" tasks={upcoming.later} />
            <Group title="No date" tasks={upcoming.none} />
          </>
        ))}

      {view === 'all' &&
        (allSorted.length === 0 ? (
          empty('No open tasks match. Enjoy it.')
        ) : sort === 'manual' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={allSorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="tlist">
                {allSorted.map((t) => (
                  <TaskRow key={t.id} t={t} sortable />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="tlist">
            {allSorted.map((t) => (
              <TaskRow key={t.id} t={t} />
            ))}
          </ul>
        ))}

      {view === 'done' &&
        (done.length === 0 ? (
          empty('Completed tasks will appear here.')
        ) : (
          <ul className="tlist">
            {done.map((t) => (
              <TaskRow key={t.id} t={t} />
            ))}
          </ul>
        ))}
    </div>
  );
}
