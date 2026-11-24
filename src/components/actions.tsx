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

import { $t } from '@/lib/i18n';
export interface QuickAction {
  id: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  key?: string;
  run: () => void;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'idea', label: $t("New idea"), sub: $t("Capture it before it’s gone"), icon: Lightbulb, key: 'I', run: () => openModal({ kind: 'idea' }) },
  { id: 'video', label: $t("New video"), sub: $t("Start a production"), icon: Clapperboard, key: 'V', run: () => openModal({ kind: 'project' }) },
  { id: 'task', label: $t("New task"), sub: $t("Personal or professional"), icon: ListPlus, key: 'T', run: () => openModal({ kind: 'task' }) },
  { id: 'event', label: $t("New event"), sub: $t("Recording, edit, meeting…"), icon: CalendarPlus, key: 'E', run: () => openModal({ kind: 'event' }) },
  { id: 'habit', label: $t("New habit"), sub: $t("Build consistency"), icon: Repeat, run: () => openModal({ kind: 'habit' }) },
  { id: 'goal', label: $t("New goal"), sub: $t("Daily to yearly"), icon: Flag, run: () => openModal({ kind: 'goal' }) },
  { id: 'stats', label: $t("Log statistics"), sub: $t("Record a post’s numbers"), icon: BarChart3, run: () => openModal({ kind: 'stats' }) },
  { id: 'upload', label: $t("Upload asset"), sub: $t("Images, video, audio, docs"), icon: Upload, key: 'U', run: () => openModal({ kind: 'upload' }) },
  { id: 'time', label: $t("Log time"), sub: $t("Track hours creating"), icon: Timer, run: () => openModal({ kind: 'timelog' }) },
];
