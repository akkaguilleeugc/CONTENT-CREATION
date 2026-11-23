import {
  BarChart3,
  CalendarPlus,
  Clapperboard,
  Flag,
  Lightbulb,
  ListPlus,
  Repeat,
  Timer,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { openModal } from '@/lib/ui';

export interface QuickAction {
  id: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  key?: string;
  run: () => void;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'idea', label: 'New idea', sub: 'Capture it before it’s gone', icon: Lightbulb, key: 'I', run: () => openModal({ kind: 'idea' }) },
  { id: 'video', label: 'New video', sub: 'Start a production', icon: Clapperboard, key: 'V', run: () => openModal({ kind: 'project' }) },
  { id: 'task', label: 'New task', sub: 'Personal or professional', icon: ListPlus, key: 'T', run: () => openModal({ kind: 'task' }) },
  { id: 'event', label: 'New event', sub: 'Recording, edit, meeting…', icon: CalendarPlus, key: 'E', run: () => openModal({ kind: 'event' }) },
  { id: 'habit', label: 'New habit', sub: 'Build consistency', icon: Repeat, run: () => openModal({ kind: 'habit' }) },
  { id: 'goal', label: 'New goal', sub: 'Daily to yearly', icon: Flag, run: () => openModal({ kind: 'goal' }) },
  { id: 'stats', label: 'Log statistics', sub: 'Record a post’s numbers', icon: BarChart3, run: () => openModal({ kind: 'stats' }) },
  { id: 'upload', label: 'Upload asset', sub: 'Images, video, audio, docs', icon: Upload, key: 'U', run: () => openModal({ kind: 'upload' }) },
  { id: 'time', label: 'Log time', sub: 'Track hours creating', icon: Timer, run: () => openModal({ kind: 'timelog' }) },
];
