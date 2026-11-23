import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QUICK_ACTIONS } from '@/components/actions';
import { BrandMark, Wordmark } from '@/components/brand';
import { CommandPalette, QuickCreate } from '@/components/CommandPalette';
import { NAV } from '@/components/nav';
import { ConfirmHost, Modal, Skeleton, Toaster } from '@/components/overlay';
import { resolveTheme, Shell } from '@/components/Shell';
import { Button, Field, Input } from '@/components/ui';
import { ModalHost } from '@/features/ModalHost';
import { startReminders } from '@/features/reminders';
import { buildSample } from '@/lib/sample';
import { useStore } from '@/lib/store';
import { toast, useUI } from '@/lib/ui';
import { isTypingTarget } from '@/lib/utils';

const Overview = lazy(() => import('@/pages/Overview'));
const Ideas = lazy(() => import('@/pages/Ideas'));
const Studio = lazy(() => import('@/pages/Studio'));
const Workspace = lazy(() => import('@/pages/Workspace'));
const CalendarPage = lazy(() => import('@/pages/Calendar'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Trackers = lazy(() => import('@/pages/Trackers'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const BrandKit = lazy(() => import('@/pages/BrandKit'));
const Assets = lazy(() => import('@/pages/Assets'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <Skeleton h={14} w={120} />
      <div style={{ height: 14 }} />
      <Skeleton h={48} w="min(420px, 80%)" r={14} />
      <div style={{ height: 28 }} />
      <div className="grid-kpis">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h={96} r={18} />
        ))}
      </div>
      <div style={{ height: 20 }} />
      <Skeleton h={320} r={22} />
    </div>
  );
}

/** Applies the saved theme (and follows the OS when set to "system"). */
function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const apply = () => {
      const t = resolveTheme(theme);
      document.documentElement.setAttribute('data-theme', t);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0B0F14' : '#EFF8FF');
    };
    apply();
    try {
      localStorage.setItem('creator-os:theme', theme);
    } catch {
      /* private mode */
    }
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function useShortcuts() {
  const navigate = useNavigate();
  const gPending = useRef<number>(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.setPalette(!ui.paletteOpen);
        return;
      }
      if (mod || e.altKey || isTypingTarget(e.target)) return;
      const overlayOpen = !!ui.modal || ui.paletteOpen || !!ui.confirm || ui.moreOpen;
      const k = e.key.toLowerCase();
      if (ui.quickOpen) {
        const a = QUICK_ACTIONS.find((x) => x.key?.toLowerCase() === k);
        if (a) {
          e.preventDefault();
          ui.setQuick(false);
          a.run();
        }
        return;
      }
      if (overlayOpen) return;
      if (Date.now() - gPending.current < 1200) {
        gPending.current = 0;
        const n = NAV.find((x) => x.key === k);
        if (n) {
          e.preventDefault();
          navigate(n.to);
        }
        return;
      }
      if (k === 'g') {
        gPending.current = Date.now();
        return;
      }
      if (k === 'n' || k === 'c') {
        e.preventDefault();
        ui.setQuick(true);
      } else if (k === '/') {
        e.preventDefault();
        ui.setPalette(true);
      } else {
        const a = QUICK_ACTIONS.find((x) => x.key?.toLowerCase() === k);
        if (a) {
          e.preventDefault();
          a.run();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function Welcome() {
  const onboarded = useStore((s) => s.settings.onboarded);
  const hydrated = useStore((s) => s.hydrated);
  const settings = useStore((s) => s.settings);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  if (!hydrated || onboarded) return null;
  const finish = (withSample: boolean) => {
    const st = useStore.getState();
    st.setSettings({ onboarded: true, profile: { ...settings.profile, name: name.trim(), handle: handle.trim().replace(/^@?/, handle.trim() ? '@' : '') } });
    if (withSample) {
      st.loadSample(buildSample(settings));
      toast('Sample data loaded', { description: 'Remove it any time from Settings → Data.' });
    } else toast('Your Creator OS is ready', { description: 'Press N to create anything.' });
  };
  return (
    <Modal open onClose={() => finish(false)} title={<span className="row gap-12"><BrandMark size={36} /> Welcome to Creator OS</span>} description="Your private operating system for ideas, production, publishing and growth." size="md">
      <div className="welcome">
        <div className="welcome__hero">
          <Wordmark height={34} plate="lime" />
          <span className="accent-script welcome__script">create · ship · grow</span>
        </div>
        <div className="form-grid">
          <Field label="Your name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="How should we greet you?" autoFocus />
          </Field>
          <Field label="Handle">
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" />
          </Field>
        </div>
        <p className="subtle" style={{ fontSize: 12.5 }}>
          Everything is stored privately in this browser. You can export a backup at any time from Settings.
        </p>
        <div className="welcome__actions">
          <Button variant="primary" size="lg" onClick={() => finish(false)}>
            Start with a clean workspace
          </Button>
          <Button size="lg" onClick={() => finish(true)}>
            Explore with sample data
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Routed() {
  useShortcuts();
  const location = useLocation();
  return (
    <Shell>
      <ScrollToTop />
      <Suspense fallback={<PageSkeleton />}>
        <div key={location.pathname.split('/').slice(0, 2).join('/')} className="page-enter">
          <Routes location={location}>
            <Route path="/" element={<Overview />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/studio/:id" element={<Workspace />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/trackers" element={<Trackers />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/brand" element={<BrandKit />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Suspense>
      <ModalHost />
      <CommandPalette />
      <QuickCreate />
      <ConfirmHost />
      <Toaster />
      <Welcome />
    </Shell>
  );
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  useTheme();
  useEffect(() => (hydrated ? startReminders() : undefined), [hydrated]);
  if (!hydrated)
    return (
      <div className="boot">
        <BrandMark size={52} />
      </div>
    );
  return (
    <BrowserRouter>
      <Routed />
    </BrowserRouter>
  );
}
