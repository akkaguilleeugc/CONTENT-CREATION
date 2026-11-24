import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
} from 'date-fns';
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Clapperboard, Filter, Plus, Scissors, Send, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassSurface } from '@/components/Glass';
import { collision, useBoardSensors } from '@/components/Kanban';
import { EmptyState, Popover, usePopover } from '@/components/overlay';
import { Button, ChipToggle, PageHeader, Segmented } from '@/components/ui';
import { useIsMobile, useNow, usePlatforms } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import type { DateStr } from '@/lib/types';
import { openModal, toast } from '@/lib/ui';
import { cn, parseDate, toDateStr, todayStr, weekStart } from '@/lib/utils';

type View = 'month' | 'week' | 'day' | 'agenda';
type Kind = 'publish' | 'recording' | 'editing' | 'task' | 'event';

interface CalItem {
  key: string;
  kind: Kind;
  date: DateStr;
  time?: string;
  end?: string;
  title: string;
  refId: string;
  color: string;
  done?: boolean;
  sub?: string;
}

const KINDS: { id: Kind; label: string; icon: typeof Send }[] = [
  { id: 'publish', label: 'Publications', icon: Send },
  { id: 'recording', label: 'Recording', icon: Video },
  { id: 'editing', label: 'Editing', icon: Scissors },
  { id: 'task', label: 'Tasks', icon: CheckSquare },
  { id: 'event', label: 'Events', icon: CalendarDays },
];
const KIND_ICON = Object.fromEntries(KINDS.map((k) => [k.id, k.icon])) as Record<Kind, typeof Send>;
const HOUR = 52;

const toMin = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0);
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function useItems(range: [Date, Date], kinds: Kind[], platformFilter: string[]) {
  const s = useStore();
  const platforms = usePlatforms();
  return useMemo(() => {
    const [a, b] = [toDateStr(range[0]), toDateStr(range[1])];
    const within = (d?: string) => !!d && d >= a && d <= b;
    const out: CalItem[] = [];
    const platOk = (ids: string[]) => !platformFilter.length || ids.some((id) => platformFilter.includes(id));
    for (const p of s.projects) {
      if (!platOk(p.platformIds)) continue;
      const color = platforms.get(p.platformIds[0] ?? '')?.color ?? 'var(--royal)';
      if (kinds.includes('publish') && within(p.publishDate))
        out.push({ key: `pub-${p.id}`, kind: 'publish', date: p.publishDate!, time: p.publishTime, title: p.title || 'Untitled video', refId: p.id, color, done: p.stage === 'published', sub: p.stage === 'published' ? 'Published' : p.stage === 'scheduled' ? 'Scheduled' : p.stage });
      if (kinds.includes('recording') && within(p.recordDate)) out.push({ key: `rec-${p.id}`, kind: 'recording', date: p.recordDate!, title: p.title || 'Untitled video', refId: p.id, color: 'var(--pink)', sub: 'Recording day' });
      if (kinds.includes('editing') && within(p.editDate)) out.push({ key: `edit-${p.id}`, kind: 'editing', date: p.editDate!, title: p.title || 'Untitled video', refId: p.id, color: 'var(--royal)', sub: 'Editing day' });
    }
    if (!platformFilter.length) {
      if (kinds.includes('task'))
        for (const t of s.tasks) if (within(t.dueDate)) out.push({ key: `task-${t.id}`, kind: 'task', date: t.dueDate!, time: t.dueTime, title: t.title, refId: t.id, color: 'var(--text-3)', done: t.status === 'done' });
      if (kinds.includes('event'))
        for (const e of s.events) if (within(e.date)) out.push({ key: `ev-${e.id}`, kind: 'event', date: e.date, time: e.startTime, end: e.endTime, title: e.title, refId: e.id, color: e.type === 'recording' ? 'var(--pink)' : e.type === 'editing' ? 'var(--royal)' : 'var(--lime)', sub: e.type });
    }
    return out.sort((x, y) => (x.time ?? '99').localeCompare(y.time ?? '99'));
  }, [s.projects, s.tasks, s.events, range, kinds, platformFilter, platforms]);
}

export default function CalendarPage() {
  const isMobile = useIsMobile();
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const platforms = usePlatforms();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<DateStr>(todayStr());
  const [kinds, setKinds] = useState<Kind[]>(KINDS.map((k) => k.id));
  const [plats, setPlats] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const sensors = useBoardSensors();
  const store = useStore.getState();

  const range = useMemo<[Date, Date]>(() => {
    if (view === 'month') return [weekStart(startOfMonth(cursor), weekStartsOn), endOfWeek(endOfMonth(cursor), { weekStartsOn })];
    if (view === 'week') return [weekStart(cursor, weekStartsOn), endOfWeek(cursor, { weekStartsOn })];
    if (view === 'day') return [cursor, cursor];
    return [cursor, addDays(cursor, 44)];
  }, [view, cursor, weekStartsOn]);
  const items = useItems(range, kinds, plats);
  const byDate = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [items]);

  const step = (dir: 1 | -1) => {
    if (view === 'month') setCursor((c) => addMonths(c, dir));
    else if (view === 'week') setCursor((c) => addWeeks(c, dir));
    else if (view === 'day') setCursor((c) => addDays(c, dir));
    else setCursor((c) => addDays(c, dir * 30));
  };
  const title =
    view === 'month' ? format(cursor, 'MMMM yyyy') : view === 'week' ? `${format(range[0], 'd MMM')} – ${format(range[1], 'd MMM yyyy')}` : view === 'day' ? format(cursor, 'EEEE, d MMMM') : `From ${format(cursor, 'd MMMM')}`;

  const openItem = (i: CalItem) => {
    if (i.kind === 'task') openModal({ kind: 'task', id: i.refId });
    else if (i.kind === 'event') openModal({ kind: 'event', id: i.refId });
    else navigate(`/studio/${i.refId}`);
  };

  const moveItem = (i: CalItem, date: DateStr, time?: string) => {
    if (i.date === date && (time === undefined || time === i.time)) return;
    const label = format(parseDate(date)!, 'EEE d MMM') + (time ? ` · ${time}` : '');
    if (i.kind === 'publish') store.update('projects', i.refId, { publishDate: date, ...(time ? { publishTime: time } : {}) });
    else if (i.kind === 'recording') store.update('projects', i.refId, { recordDate: date });
    else if (i.kind === 'editing') store.update('projects', i.refId, { editDate: date });
    else if (i.kind === 'task') store.update('tasks', i.refId, { dueDate: date, ...(time ? { dueTime: time } : {}) });
    else {
      const ev = store.events.find((e) => e.id === i.refId);
      if (!ev) return;
      const patch: Record<string, string | undefined> = { date };
      if (time) {
        patch.startTime = time;
        if (ev.startTime && ev.endTime) patch.endTime = fromMin(Math.min(toMin(time) + toMin(ev.endTime) - toMin(ev.startTime), 24 * 60 - 1));
      }
      store.update('events', i.refId, patch);
    }
    toast('Rescheduled', { description: `${i.title} → ${label}` });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragKey(null);
    const item = items.find((i) => i.key === e.active.id);
    const over = e.over?.id as string | undefined;
    if (!item || !over) return;
    const [type, date, hour] = over.split('|');
    if (type === 'day') moveItem(item, date!);
    else if (type === 'slot') moveItem(item, date!, `${hour}:00`);
  };

  const dragItem = dragKey ? items.find((i) => i.key === dragKey) : null;

  return (
    <div className="page page--wide cal-page">
      <PageHeader
        title="Calendar"
        sub="Publications, recording and editing days, tasks and personal events — drag to reschedule."
        actions={
          <>
            <Button icon={<Filter />} onClick={() => setShowFilters((v) => !v)} aria-pressed={showFilters} variant={showFilters || kinds.length < 5 || plats.length ? 'primary' : 'default'}>
              Filters{kinds.length < 5 || plats.length ? ' ·' : ''}
            </Button>
            <NewMenu date={view === 'day' ? toDateStr(cursor) : selected} />
          </>
        }
      />
      {showFilters && (
        <div className="cal-filters panel">
          <div className="col" style={{ gap: 6 }}>
            <span className="eyebrow">Activity</span>
            <ChipToggle sm options={KINDS.map((k) => ({ value: k.id, label: k.label, icon: <k.icon /> }))} value={kinds} onChange={(v) => setKinds(v as Kind[])} />
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="eyebrow">Platforms {plats.length ? '· tasks & events hidden' : ''}</span>
            <ChipToggle sm options={platforms.list.map((p) => ({ value: p.id, label: p.name, color: p.color }))} value={plats} onChange={setPlats} />
          </div>
        </div>
      )}
      <div className="cal-bar">
        <div className="row">
          <Button size="sm" iconOnly icon={<ChevronLeft />} onClick={() => step(-1)} aria-label="Previous" />
          <Button size="sm" iconOnly icon={<ChevronRight />} onClick={() => step(1)} aria-label="Next" />
          <Button size="sm" onClick={() => (setCursor(new Date()), setSelected(todayStr()))}>
            Today
          </Button>
          <h2 className="cal-bar__title">{title}</h2>
        </div>
        <Segmented
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
            { value: 'agenda', label: 'Agenda' },
          ]}
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} autoScroll={{ threshold: { x: 0, y: 0.06 } }} onDragStart={(e) => setDragKey(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragKey(null)}>
        {view === 'month' && (
          <>
            <MonthGrid
              cursor={cursor}
              range={range}
              weekStartsOn={weekStartsOn}
              byDate={byDate}
              selected={selected}
              compact={isMobile}
              onSelect={setSelected}
              onOpenDay={(d) => {
                setCursor(parseDate(d)!);
                setView('day');
              }}
              onOpen={openItem}
            />
            {isMobile && <DayList date={selected} items={byDate.get(selected) ?? []} onOpen={openItem} />}
          </>
        )}
        {(view === 'week' || view === 'day') && <TimeGrid days={view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(range[0], i)) : [cursor]} byDate={byDate} onOpen={openItem} />}
        {view === 'agenda' && <Agenda byDate={byDate} onOpen={openItem} />}
        <DragOverlay dropAnimation={null}>
          {dragItem ? (
            <GlassSurface radius={8} tone="lens" className="cal-glass">
              <Chip item={dragItem} overlay />
            </GlassSurface>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function NewMenu({ date }: { date: DateStr }) {
  const pop = usePopover();
  const label = format(parseDate(date)!, 'd MMM');
  return (
    <>
      <Button variant="primary" icon={<Plus />} onClick={(e) => pop.toggle(e.currentTarget)}>
        New
      </Button>
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={230}>
        <div className="menu__label">On {label}</div>
        <CreateItems date={date} onDone={pop.close} />
      </Popover>
    </>
  );
}

function CreateItems({ date, time, onDone }: { date: DateStr; time?: string; onDone: () => void }) {
  const items: { label: string; icon: ReactNode; run: () => void }[] = [
    { label: 'Video to publish', icon: <Clapperboard />, run: () => openModal({ kind: 'project', defaults: { publishDate: date, publishTime: time } }) },
    { label: 'Event', icon: <CalendarDays />, run: () => openModal({ kind: 'event', defaults: { date, startTime: time } }) },
    { label: 'Task', icon: <CheckSquare />, run: () => openModal({ kind: 'task', defaults: { dueDate: date, dueTime: time } }) },
  ];
  return (
    <>
      {items.map((i, idx) => (
        <button
          key={i.label}
          className="menu__item"
          autoFocus={idx === 0}
          onClick={() => {
            onDone();
            i.run();
          }}
        >
          {i.icon}
          {i.label}
        </button>
      ))}
    </>
  );
}

function Chip({ item, overlay, onOpen }: { item: CalItem; overlay?: boolean; onOpen?: (i: CalItem) => void }) {
  const drag = useDraggable({ id: item.key, disabled: overlay });
  const Icon = KIND_ICON[item.kind];
  return (
    <div
      ref={overlay ? undefined : drag.setNodeRef}
      {...(overlay ? {} : drag.listeners)}
      {...(overlay ? {} : drag.attributes)}
      className={cn('cal-chip', `cal-chip--${item.kind}`, item.done && 'cal-chip--done', drag.isDragging && 'cal-chip--ghost', overlay && 'cal-chip--overlay')}
      style={{ ['--c' as string]: item.color }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(item);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.(item);
        else drag.listeners?.onKeyDown?.(e);
      }}
      title={`${item.title}${item.time ? ` · ${item.time}` : ''}`}
    >
      <Icon />
      {item.time && <span className="cal-chip__time mono">{item.time}</span>}
      <span className="truncate">{item.title}</span>
    </div>
  );
}

function DayCell({ date, inMonth, items, selected, compact, onSelect, onOpenDay, onOpen }: { date: Date; inMonth: boolean; items: CalItem[]; selected: boolean; compact: boolean; onSelect: () => void; onOpenDay: () => void; onOpen: (i: CalItem) => void }) {
  const ds = toDateStr(date);
  const { setNodeRef, isOver } = useDroppable({ id: `day|${ds}` });
  const pop = usePopover();
  const max = 3;
  return (
    <div
      ref={setNodeRef}
      className={cn('cal-cell', !inMonth && 'cal-cell--out', isToday(date) && 'cal-cell--today', selected && 'cal-cell--sel', isOver && 'cal-cell--over')}
      onClick={onSelect}
      onDoubleClick={(e) => pop.toggle(e.currentTarget)}
      role="gridcell"
      aria-label={format(date, 'EEEE d MMMM')}
      tabIndex={-1}
    >
      <div className="cal-cell__head">
        <button
          className="cal-cell__num"
          onClick={(e) => {
            e.stopPropagation();
            if (compact) onSelect();
            else onOpenDay();
          }}
          aria-label={`Open ${format(date, 'd MMMM')}`}
        >
          {format(date, 'd')}
        </button>
        {!compact && (
          <button
            className="cal-cell__add"
            onClick={(e) => {
              e.stopPropagation();
              pop.toggle(e.currentTarget);
            }}
            aria-label={`Add on ${format(date, 'd MMMM')}`}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      {compact ? (
        <div className="cal-dots">
          {items.slice(0, 4).map((i) => (
            <span key={i.key} className="dot" style={{ background: i.color, width: 6, height: 6, boxShadow: 'none' }} />
          ))}
        </div>
      ) : (
        <div className="cal-cell__items">
          {items.slice(0, max).map((i) => (
            <Chip key={i.key} item={i} onOpen={onOpen} />
          ))}
          {items.length > max && (
            <button
              className="cal-more"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDay();
              }}
            >
              +{items.length - max} more
            </button>
          )}
        </div>
      )}
      <Popover anchor={pop.anchor} onClose={pop.close} width={220}>
        <div className="menu__label">Add on {format(date, 'd MMM')}</div>
        <CreateItems date={ds} onDone={pop.close} />
      </Popover>
    </div>
  );
}

function MonthGrid({ cursor, range, weekStartsOn, byDate, selected, compact, onSelect, onOpenDay, onOpen }: { cursor: Date; range: [Date, Date]; weekStartsOn: 0 | 1; byDate: Map<string, CalItem[]>; selected: string; compact: boolean; onSelect: (d: string) => void; onOpenDay: (d: string) => void; onOpen: (i: CalItem) => void }) {
  const days: Date[] = [];
  for (let d = range[0]; d <= range[1]; d = addDays(d, 1)) days.push(d);
  const heads = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart(new Date(), weekStartsOn), i), compact ? 'EEEEE' : 'EEE'));
  return (
    <div className={cn('cal-month panel', compact && 'cal-month--compact')} role="grid">
      <div className="cal-month__heads">
        {heads.map((h, i) => (
          <div key={i}>{h}</div>
        ))}
      </div>
      <div className="cal-month__grid">
        {days.map((d) => (
          <DayCell key={d.toISOString()} date={d} inMonth={isSameMonth(d, cursor)} items={byDate.get(toDateStr(d)) ?? []} selected={selected === toDateStr(d)} compact={compact} onSelect={() => onSelect(toDateStr(d))} onOpenDay={() => onOpenDay(toDateStr(d))} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function DayList({ date, items, onOpen }: { date: string; items: CalItem[]; onOpen: (i: CalItem) => void }) {
  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel__head">
        <h3 className="panel__title">{format(parseDate(date)!, 'EEEE d MMMM')}</h3>
        <NewMenu date={date} />
      </div>
      <div className="panel__body">
        {items.length === 0 ? <p className="subtle" style={{ fontSize: 13 }}>Nothing planned.</p> : <AgendaRows items={items} onOpen={onOpen} />}
      </div>
    </div>
  );
}

function AgendaRows({ items, onOpen }: { items: CalItem[]; onOpen: (i: CalItem) => void }) {
  return (
    <ul className="agenda">
      {items.map((i) => {
        const Icon = KIND_ICON[i.kind];
        return (
          <li key={i.key} className={cn('agenda__item', i.done && 'agenda__item--done')}>
            <span className="cal-kind" style={{ ['--c' as string]: i.color }}>
              <Icon />
            </span>
            <button className="agenda__main" onClick={() => onOpen(i)}>
              <span className="agenda__title truncate">{i.title}</span>
              <span className="agenda__meta" style={{ textTransform: 'capitalize' }}>
                {KINDS.find((k) => k.id === i.kind)?.label.replace(/s$/, '')}
                {i.sub && i.kind !== 'recording' && i.kind !== 'editing' ? ` · ${i.sub}` : ''}
              </span>
            </button>
            <span className="agenda__time mono">
              {i.time ?? 'All day'}
              {i.end ? `–${i.end}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Agenda({ byDate, onOpen }: { byDate: Map<string, CalItem[]>; onOpen: (i: CalItem) => void }) {
  const days = Array.from(byDate.keys()).sort();
  if (!days.length)
    return (
      <div className="panel">
        <EmptyState icon={<CalendarDays />} title="Nothing in the next 45 days" text="Schedule a publication, a recording day or an event." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'event' })}>New event</Button>} />
      </div>
    );
  return (
    <div className="cal-agenda">
      {days.map((d) => (
        <section key={d} className="cal-agenda__day panel">
          <div className={cn('cal-agenda__date', d === todayStr() && 'cal-agenda__date--today')}>
            <span className="display">{format(parseDate(d)!, 'd')}</span>
            <span>{format(parseDate(d)!, 'EEE · MMM')}</span>
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <AgendaRows items={byDate.get(d)!} onOpen={onOpen} />
          </div>
        </section>
      ))}
    </div>
  );
}

function Slot({ date, hour }: { date: string; hour: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot|${date}|${String(hour).padStart(2, '0')}` });
  const pop = usePopover();
  return (
    <div ref={setNodeRef} className={cn('cal-slot', isOver && 'cal-slot--over')} onClick={(e) => pop.toggle(e.currentTarget)}>
      <Popover anchor={pop.anchor} onClose={pop.close} width={220}>
        <div className="menu__label">
          {format(parseDate(date)!, 'EEE d MMM')} · {String(hour).padStart(2, '0')}:00
        </div>
        <CreateItems date={date} time={`${String(hour).padStart(2, '0')}:00`} onDone={pop.close} />
      </Popover>
    </div>
  );
}

function layout(items: CalItem[]) {
  const timed = items.filter((i) => i.time).map((i) => ({ i, s: toMin(i.time), e: Math.max(toMin(i.end) || toMin(i.time) + 45, toMin(i.time) + 30) }));
  timed.sort((a, b) => a.s - b.s);
  const cols: number[] = [];
  const placed = timed.map((t) => {
    let c = cols.findIndex((end) => end <= t.s);
    if (c === -1) {
      c = cols.length;
      cols.push(t.e);
    } else cols[c] = t.e;
    return { ...t, col: c };
  });
  return placed.map((p) => ({ ...p, cols: Math.max(1, ...placed.filter((q) => q.s < p.e && q.e > p.s).map((q) => q.col + 1)) }));
}

function TimeGrid({ days, byDate, onOpen }: { days: Date[]; byDate: Map<string, CalItem[]>; onOpen: (i: CalItem) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const now = useNow(60_000);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = HOUR * 7;
  }, []);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div className="cal-time panel" style={{ ['--days' as string]: days.length }}>
      <div className="cal-time__heads">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={cn('cal-time__head', isToday(d) && 'cal-time__head--today')}>
            <span>{format(d, 'EEE')}</span>
            <span className="display">{format(d, 'd')}</span>
          </div>
        ))}
      </div>
      <div className="cal-time__allday">
        <div className="eyebrow" style={{ fontSize: 9 }}>All day</div>
        {days.map((d) => {
          const ds = toDateStr(d);
          return <AllDay key={ds} date={ds} items={(byDate.get(ds) ?? []).filter((i) => !i.time)} onOpen={onOpen} />;
        })}
      </div>
      <div className="cal-time__scroll" ref={scroller}>
        <div className="cal-time__body" style={{ height: HOUR * 24 }}>
          <div className="cal-time__gutter">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR }}>
                <span>{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const ds = toDateStr(d);
            const timed = layout(byDate.get(ds) ?? []);
            return (
              <div key={ds} className="cal-time__col">
                {hours.map((h) => (
                  <Slot key={h} date={ds} hour={h} />
                ))}
                {timed.map(({ i, s, e, col, cols }) => (
                  <div key={i.key} className="cal-time__item" style={{ top: (s / 60) * HOUR, height: Math.max(22, ((e - s) / 60) * HOUR - 2), left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}>
                    <Chip item={i} onOpen={onOpen} />
                  </div>
                ))}
                {isToday(d) && <div className="cal-now" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AllDay({ date, items, onOpen }: { date: string; items: CalItem[]; onOpen: (i: CalItem) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day|${date}` });
  return (
    <div ref={setNodeRef} className={cn('cal-time__allday-cell', isOver && 'cal-cell--over')}>
      {items.map((i) => (
        <Chip key={i.key} item={i} onOpen={onOpen} />
      ))}
    </div>
  );
}
