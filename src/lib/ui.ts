import { create } from 'zustand';
import type {
  AnalyticsRecord,
  Asset,
  CalendarEvent,
  ContentProject,
  Idea,
  Task,
} from './types';
import { uid } from './utils';

export type ModalSpec =
  | { kind: 'idea'; id?: string; defaults?: Partial<Idea> }
  | { kind: 'project'; defaults?: Partial<ContentProject> }
  | { kind: 'task'; id?: string; defaults?: Partial<Task> }
  | { kind: 'habit'; id?: string }
  | { kind: 'goal'; id?: string }
  | { kind: 'goal-progress'; goalId: string }
  | { kind: 'event'; id?: string; defaults?: Partial<CalendarEvent> }
  | { kind: 'stats'; id?: string; defaults?: Partial<AnalyticsRecord> }
  | { kind: 'upload'; defaults?: Partial<Asset> & { projectId?: string }; files?: File[] }
  | { kind: 'asset'; id: string }
  | { kind: 'timelog'; id?: string; defaults?: { projectId?: string; minutes?: number; activity?: string } }
  | { kind: 'reference'; id?: string }
  | { kind: 'color'; id?: string; paletteId?: string }
  | { kind: 'combo'; id?: string }
  | { kind: 'palette'; id?: string };

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
  action?: { label: string; run: () => void };
}

interface ConfirmSpec {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
  resolve: (ok: boolean) => void;
}

interface UIState {
  modal: ModalSpec | null;
  paletteOpen: boolean;
  quickOpen: boolean;
  moreOpen: boolean;
  toasts: Toast[];
  confirm: ConfirmSpec | null;
  open: (m: ModalSpec) => void;
  close: () => void;
  setPalette: (v: boolean) => void;
  setQuick: (v: boolean) => void;
  setMore: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  modal: null,
  paletteOpen: false,
  quickOpen: false,
  moreOpen: false,
  toasts: [],
  confirm: null,
  open: (modal) => set({ modal, paletteOpen: false, quickOpen: false, moreOpen: false }),
  close: () => set({ modal: null }),
  setPalette: (paletteOpen) => set({ paletteOpen, quickOpen: false }),
  setQuick: (quickOpen) => set({ quickOpen, paletteOpen: false }),
  setMore: (moreOpen) => set({ moreOpen }),
}));

export const openModal = (m: ModalSpec) => useUI.getState().open(m);
export const closeModal = () => useUI.getState().close();

export function toast(title: string, opts: Partial<Omit<Toast, 'id' | 'title'>> = {}) {
  const t: Toast = { id: uid(), title, tone: 'success', ...opts };
  useUI.setState((s) => ({ toasts: [...s.toasts.slice(-3), t] }));
  setTimeout(() => dismissToast(t.id), t.action ? 6000 : 3600);
  return t.id;
}
export const dismissToast = (id: string) => useUI.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

export function confirmDialog(opts: Omit<ConfirmSpec, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useUI.setState({
      confirm: {
        ...opts,
        resolve: (ok) => {
          useUI.setState({ confirm: null });
          resolve(ok);
        },
      },
    });
  });
}
