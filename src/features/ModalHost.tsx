import { useUI } from '@/lib/ui';
import { AssetModal, UploadModal } from './assets';
import {
  BrandFontModal,
  BrandProfileModal,
  ColorModal,
  ComboModal,
  EventModal,
  GoalModal,
  GoalProgressModal,
  HabitModal,
  IdeaModal,
  PaletteModal,
  ProjectModal,
  ReferenceModal,
  StatsModal,
  TaskModal,
  TimeLogModal,
} from './forms';

/** Renders the single active global modal. Keyed so forms reset between openings. */
export function ModalHost() {
  const m = useUI((s) => s.modal);
  if (!m) return null;
  const key = JSON.stringify({ k: m.kind, id: 'id' in m ? m.id : undefined });
  switch (m.kind) {
    case 'idea':
      return <IdeaModal key={key} id={m.id} defaults={m.defaults} />;
    case 'project':
      return <ProjectModal key={key} defaults={m.defaults} />;
    case 'task':
      return <TaskModal key={key} id={m.id} defaults={m.defaults} />;
    case 'habit':
      return <HabitModal key={key} id={m.id} />;
    case 'goal':
      return <GoalModal key={key} id={m.id} />;
    case 'goal-progress':
      return <GoalProgressModal key={key} goalId={m.goalId} />;
    case 'event':
      return <EventModal key={key} id={m.id} defaults={m.defaults} />;
    case 'stats':
      return <StatsModal key={key} id={m.id} defaults={m.defaults} />;
    case 'upload':
      return <UploadModal key={key} defaults={m.defaults} files={m.files} />;
    case 'asset':
      return <AssetModal key={key} id={m.id} />;
    case 'timelog':
      return <TimeLogModal key={key} id={m.id} defaults={m.defaults} />;
    case 'reference':
      return <ReferenceModal key={key} id={m.id} />;
    case 'color':
      return <ColorModal key={key} id={m.id} paletteId={m.paletteId} />;
    case 'combo':
      return <ComboModal key={key} id={m.id} />;
    case 'palette':
      return <PaletteModal key={key} id={m.id} />;
    case 'brand':
      return <BrandProfileModal key={key} />;
    case 'font':
      return <BrandFontModal key={key} id={m.id} />;
  }
}
