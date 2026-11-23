import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KanbanColumn {
  id: string;
  title: string;
  hint?: string;
  accent?: string;
  footer?: ReactNode;
}

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function useBoardSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
}

function Column({ col, count, children }: { col: KanbanColumn; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section ref={setNodeRef} className={cn('kcol', isOver && 'kcol--over')} aria-label={col.title}>
      <header className="kcol__head">
        <span className="kcol__dot" style={{ background: col.accent }} />
        <span className="kcol__title">{col.title}</span>
        <span className="kcol__count tnum">{count}</span>
      </header>
      {col.hint && <div className="kcol__hint">{col.hint}</div>}
      <div className="kcol__body">{children}</div>
      {col.footer}
    </section>
  );
}

function Card({ id, children, onOpen }: { id: string; children: ReactNode; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('kcard', isDragging && 'kcard--ghost')}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
        else listeners?.onKeyDown?.(e);
      }}
    >
      {children}
    </div>
  );
}

export function KanbanBoard<T extends { id: string }>({
  columns,
  items,
  columnOf,
  renderCard,
  onMove,
  onOpen,
  emptyLabel = 'Drop here',
}: {
  columns: KanbanColumn[];
  items: T[];
  columnOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (item: T, toColumn: string) => void;
  onOpen: (item: T) => void;
  emptyLabel?: string;
}) {
  const sensors = useBoardSensors();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? items.find((i) => i.id === activeId) : null;

  const end = (e: DragEndEvent) => {
    setActiveId(null);
    const item = items.find((i) => i.id === e.active.id);
    const to = e.over?.id as string | undefined;
    if (item && to && columnOf(item) !== to) onMove(item, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={end} onDragCancel={() => setActiveId(null)}>
      <div className="board">
        {columns.map((col) => {
          const colItems = items.filter((i) => columnOf(i) === col.id);
          return (
            <Column key={col.id} col={col} count={colItems.length}>
              {colItems.map((item) => (
                <Card key={item.id} id={item.id} onOpen={() => onOpen(item)}>
                  {renderCard(item)}
                </Card>
              ))}
              {colItems.length === 0 && <div className="kcol__empty">{emptyLabel}</div>}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {active ? <div className="kcard kcard--overlay">{renderCard(active)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
