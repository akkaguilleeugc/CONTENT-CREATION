import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Clapperboard,
  CornerDownLeft,
  File,
  Flag,
  Lightbulb,
  Moon,
  PanelLeft,
  Repeat,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { stageLabel } from '@/lib/constants';
import { useStore } from '@/lib/store';
import { openModal, useUI } from '@/lib/ui';
import { cn, fmtDate, matches } from '@/lib/utils';
import { QUICK_ACTIONS } from './actions';
import { NAV } from './nav';
import { GlassSurface } from './Glass';
import { Modal } from './overlay';
import { MOD, resolveTheme } from './Shell';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const { paletteOpen, setPalette } = useUI();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const s = useStore();

  useEffect(() => {
    if (paletteOpen) {
      setQ('');
      setActive(0);
    }
  }, [paletteOpen]);

  const items = useMemo<Item[]>(() => {
    if (!paletteOpen) return [];
    const close = () => setPalette(false);
    const go = (to: string) => () => {
      close();
      navigate(to);
    };
    const out: Item[] = [];
    const query = q.trim();

    if (query) {
      const take = <T,>(arr: T[], n = 5) => arr.slice(0, n);
      take(s.projects.filter((p) => matches(query, p.title, p.description, p.tags, p.category))).forEach((p) =>
        out.push({ id: `p-${p.id}`, group: 'Content', label: p.title || 'Untitled video', hint: stageLabel(p.stage), icon: <Clapperboard />, run: go(`/studio/${p.id}`) }),
      );
      take(s.ideas.filter((i) => matches(query, i.title, i.description, i.tags, i.category))).forEach((i) =>
        out.push({ id: `i-${i.id}`, group: 'Ideas', label: i.title, hint: i.category, icon: <Lightbulb />, run: () => { close(); openModal({ kind: 'idea', id: i.id }); } }),
      );
      take(s.tasks.filter((t) => matches(query, t.title, t.description))).forEach((t) =>
        out.push({ id: `t-${t.id}`, group: 'Tasks', label: t.title, hint: t.status === 'done' ? 'Done' : t.dueDate ? fmtDate(t.dueDate, 'd MMM') : 'No date', icon: <CheckSquare />, run: () => { close(); openModal({ kind: 'task', id: t.id }); } }),
      );
      take(s.events.filter((e) => matches(query, e.title, e.notes))).forEach((e) =>
        out.push({ id: `e-${e.id}`, group: 'Calendar', label: e.title, hint: fmtDate(e.date, 'd MMM'), icon: <CalendarDays />, run: () => { close(); openModal({ kind: 'event', id: e.id }); } }),
      );
      take(s.habits.filter((h) => matches(query, h.name))).forEach((h) =>
        out.push({ id: `h-${h.id}`, group: 'Trackers', label: h.name, hint: 'Habit', icon: <Repeat />, run: go('/trackers') }),
      );
      take(s.goals.filter((g) => matches(query, g.title))).forEach((g) =>
        out.push({ id: `g-${g.id}`, group: 'Trackers', label: g.title, hint: 'Goal', icon: <Flag />, run: go('/trackers?tab=goals') }),
      );
      take(s.assets.filter((a) => matches(query, a.name, a.tags))).forEach((a) =>
        out.push({ id: `a-${a.id}`, group: 'Assets', label: a.name, hint: a.type, icon: <File />, run: () => { close(); openModal({ kind: 'asset', id: a.id }); } }),
      );
    }

    const actions: Item[] = QUICK_ACTIONS.map((a) => ({
      id: `qa-${a.id}`,
      group: 'Create',
      label: a.label,
      hint: a.sub,
      icon: <a.icon />,
      run: () => {
        close();
        a.run();
      },
    }));
    const nav: Item[] = NAV.map((n) => ({ id: `nav-${n.to}`, group: 'Go to', label: n.label, hint: `G then ${n.key.toUpperCase()}`, icon: <n.icon />, run: go(n.to) }));
    const cmds: Item[] = [
      {
        id: 'cmd-theme',
        group: 'Commands',
        label: 'Toggle light / dark theme',
        icon: <Moon />,
        run: () => {
          close();
          const cur = resolveTheme(useStore.getState().settings.theme);
          useStore.getState().setSettings({ theme: cur === 'dark' ? 'light' : 'dark' });
        },
        keywords: 'appearance mode',
      },
      {
        id: 'cmd-sidebar',
        group: 'Commands',
        label: 'Toggle sidebar',
        icon: <PanelLeft />,
        run: () => {
          close();
          const st = useStore.getState();
          st.setSettings({ sidebarCollapsed: !st.settings.sidebarCollapsed });
        },
      },
    ];
    const filter = (arr: Item[]) => (query ? arr.filter((i) => matches(query, i.label, i.hint, i.keywords)) : arr);
    return [...out, ...filter(actions), ...filter(nav), ...filter(cmds)];
  }, [paletteOpen, q, s, navigate, setPalette]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!paletteOpen) return null;

  let lastGroup = '';
  return createPortal(
    <div className="palette-root" onKeyDown={(e) => e.key === 'Escape' && setPalette(false)}>
      <div className="modal-backdrop" onClick={() => setPalette(false)} />
      <GlassSurface radius={20} tone="sheet" className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette__input">
          <Search />
          <input
            autoFocus
            value={q}
            placeholder="Search ideas, videos, tasks… or type a command"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                items[active]?.run();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                setPalette(false);
              }
            }}
            aria-label="Command search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette__list" ref={listRef} id="palette-list" role="listbox">
          {items.length === 0 && <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-3)' }}>No results for “{q}”.</div>}
          {items.map((it, idx) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="palette__group">{header}</div>}
                <button
                  data-idx={idx}
                  role="option"
                  aria-selected={idx === active}
                  className={cn('palette__item', idx === active && 'palette__item--active')}
                  onMouseMove={() => setActive(idx)}
                  onClick={it.run}
                >
                  {it.icon}
                  <span className="truncate">{it.label}</span>
                  {it.hint && <span className="hint">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette__foot">
          <span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">
              <CornerDownLeft size={10} />
            </span>{' '}
            open
          </span>
          <span>
            <span className="kbd">{MOD}K</span> toggle
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <span className="kbd">N</span> quick create <ArrowRight size={11} />
          </span>
        </div>
      </GlassSurface>
    </div>,
    document.body,
  );
}

export function QuickCreate() {
  const { quickOpen, setQuick } = useUI();
  return (
    <Modal open={quickOpen} onClose={() => setQuick(false)} title="Create" description="Add anything, from anywhere." initialFocus={false}>
      <div className="quick-grid">
        {QUICK_ACTIONS.map((a, i) => (
          <button
            key={a.id}
            className="quick-item"
            autoFocus={i === 0}
            onClick={() => {
              setQuick(false);
              a.run();
            }}
          >
            <span className="quick-item__icon">
              <a.icon />
            </span>
            <span style={{ minWidth: 0 }}>
              <div className="quick-item__title">{a.label}</div>
              <div className="quick-item__sub truncate">{a.sub}</div>
            </span>
            {a.key && <span className="kbd hide-mobile">{a.key}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
