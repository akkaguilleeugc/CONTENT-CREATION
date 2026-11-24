import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QUICK_ACTIONS } from '@/components/actions';
import { BrandMark, Wordmark } from '@/components/brand';
import { Mascot } from '@/components/Mascot';
import { CommandPalette, QuickCreate } from '@/components/CommandPalette';
import { NAV, titleFor } from '@/components/nav';
import { ConfirmHost, Modal, Skeleton, Toaster } from '@/components/overlay';
import { resolveTheme, Shell } from '@/components/Shell';
import { Button, Field, Input } from '@/components/ui';
import { ModalHost } from '@/features/ModalHost';
import { startReminders } from '@/features/reminders';
import { startAchievements } from '@/lib/celebrate';
import { LANG, LANGS, setLang } from '@/lib/i18n';
import { initPush } from '@/lib/push';
import { initSync, useSync } from '@/lib/sync';
import { useBrandFontRegistry } from '@/lib/brandFonts';
import { setBadge } from '@/lib/pwa';
import { buildSample } from '@/lib/sample';
import { useStore } from '@/lib/store';
import { openModal, toast, useUI } from '@/lib/ui';
import { isTypingTarget, todayStr } from '@/lib/utils';

import { $t } from '@/lib/i18n';
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
const AccountPage = lazy(() => import('@/pages/Account'));
const LegalPage = lazy(() => import('@/pages/Legal'));
const AiPage = lazy(() => import('@/pages/Ai'));

function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label={$t("Loading")}>
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

const PUBLIC_ROUTES = ['/privacy', '/terms', '/cookies', '/support', '/account'];

function Welcome() {
  const loc = useLocation();
  const navigate = useNavigate();
  const syncStatus = useSync((s) => s.status);
  const onboarded = useStore((s) => s.settings.onboarded);
  const hydrated = useStore((s) => s.hydrated);
  const settings = useStore((s) => s.settings);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  if (!hydrated || onboarded || PUBLIC_ROUTES.includes(loc.pathname)) return null;
  const finish = (withSample: boolean) => {
    const st = useStore.getState();
    st.setSettings({ onboarded: true, profile: { ...settings.profile, name: name.trim(), handle: handle.trim().replace(/^@?/, handle.trim() ? '@' : '') } });
    if (withSample) {
      st.loadSample(buildSample(settings));
      toast($t("Sample data loaded"), { description: $t("Remove it any time from Settings → Data.") });
    } else toast($t("KROOPY is ready"), { description: $t("Press N to create anything.") });
  };
  return (
    <Modal open onClose={() => finish(false)} title={<span className="row gap-12"><BrandMark size={36} /> {$t("Welcome to KROOPY")}</span>} description={$t("Your private operating system for ideas, production, publishing and growth.")} size="md">
      <div className="welcome">
        <div className="lang-chips" role="group" aria-label={$t('Language')}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" className={l.id === LANG ? 'lang-chip lang-chip--on' : 'lang-chip'} onClick={() => l.id !== LANG && setLang(l.id)} aria-pressed={l.id === LANG}>
              <span aria-hidden>{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
        <div className="welcome__hero">
          <Mascot className="welcome__mascot" size={112} state="excited" />
          <Wordmark height={34} plate="lime" />
          <span className="accent-script welcome__script">{$t("create · ship · grow")}</span>
        </div>
        <div className="form-grid">
          <Field label={$t("Your name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={$t("How should we greet you?")} autoFocus />
          </Field>
          <Field label={$t("Handle")}>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={$t("@yourhandle")} />
          </Field>
        </div>
        <p className="subtle" style={{ fontSize: 12.5 }}>
          {$t("Everything is stored privately in this browser. You can export a backup at any time from Settings.")}
        </p>
        <div className="welcome__actions">
          <Button variant="primary" size="lg" onClick={() => finish(false)}>
            {$t("Start with a clean workspace")}
          </Button>
          <Button size="lg" onClick={() => finish(true)}>
            {$t("Explore with sample data")}
          </Button>
        </div>
        {syncStatus !== 'unconfigured' && (
          <p className="subtle welcome__signin">
            {$t('Already use KROOPY on another device?')}{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                useStore.getState().setSettings({ onboarded: true });
                navigate('/account');
              }}
            >
              {$t('Sign in to sync')}
            </button>
          </p>
        )}
        <p className="subtle welcome__legal">
          <Link to="/privacy">{$t('Privacy Policy')}</Link> · <Link to="/terms">{$t('Terms of Use')}</Link>
        </p>
      </div>
    </Modal>
  );
}

/** One-time note: only strictly necessary storage is used (no tracking cookies), so no consent is needed — but people are told. */
function StorageNotice() {
  const onboarded = useStore((s) => s.settings.onboarded);
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem('kroopy:storage-notice') === '1';
    } catch {
      return true;
    }
  });
  if (!onboarded || seen) return null;
  return (
    <div className="storage-notice" role="status">
      <p>
        {$t('KROOPY only stores what it needs to work on this device — no ads, no tracking cookies.')}{' '}
        <Link to="/cookies" className="link">{$t('Learn more')}</Link>
      </p>
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          setSeen(true);
          try {
            localStorage.setItem('kroopy:storage-notice', '1');
          } catch {
            /* ignore */
          }
        }}
      >
        {$t('Got it')}
      </Button>
    </div>
  );
}

/** Home-screen shortcuts open straight into an action: /?action=idea|video|task|event. */
function useLaunchActions() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    if (!action && !params.has('source')) return;
    const kinds = { idea: 'idea', video: 'project', task: 'task', event: 'event' } as const;
    if (action && action in kinds) openModal({ kind: kinds[action as keyof typeof kinds] });
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Android share sheet → KROOPY: whatever you share (a TikTok, a reel, an article) becomes an idea. */
function ShareTarget() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const text = params.get('text') ?? '';
    const url = params.get('url') || text.match(/https?:\/\/\S+/)?.[0] || '';
    const description = text.replace(url, '').trim();
    let host = '';
    try {
      host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
    } catch {
      /* not a URL */
    }
    const title = (params.get('title') || description.split('\n')[0] || (host ? $t('Idea from {host}', { host }) : $t('Shared idea'))).slice(0, 120);
    navigate('/ideas', { replace: true });
    openModal({ kind: 'idea', defaults: { title, description: description === title ? '' : description, reference: url } });
  }, [navigate]);
  return null;
}

/** Overdue + due-today tasks on the home-screen icon. */
function useAppBadge() {
  const tasks = useStore((s) => s.tasks);
  useEffect(() => {
    const today = todayStr();
    setBadge(tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= today).length);
  }, [tasks]);
}

/** Phones: track when the on-screen keyboard is likely open (a text field has focus). */
function useKeyboardAware() {
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, select') || el.isContentEditable);
    const onIn = (e: FocusEvent) => isField(e.target) && document.body.classList.add('kb-open');
    const onOut = () => setTimeout(() => !isField(document.activeElement) && document.body.classList.remove('kb-open'), 60);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);
}

function useDocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = titleFor(pathname);
    document.title = pathname === '/' || t === 'KROOPY' ? 'KROOPY' : `${t} · KROOPY`;
  }, [pathname]);
}

function Routed() {
  useShortcuts();
  useBrandFontRegistry();
  useLaunchActions();
  useAppBadge();
  useDocumentTitle();
  useKeyboardAware();
  const location = useLocation();
  return (
    <Shell>
      <ScrollToTop />
      <Suspense fallback={<PageSkeleton />}>
        <div key={location.pathname.split('/').slice(0, 2).join('/')} className="page-enter">
          <Routes location={location}>
            <Route path="/" element={<Overview />} />
            <Route path="/ai" element={<AiPage />} />
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
            <Route path="/share" element={<ShareTarget />} />
            <Route path="/account" element={<AccountPage />} />
            {['/privacy', '/terms', '/cookies', '/support'].map((p) => (
              <Route key={p} path={p} element={<LegalPage />} />
            ))}
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
      <StorageNotice />
    </Shell>
  );
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  useTheme();
  useEffect(() => (hydrated ? startReminders() : undefined), [hydrated]);
  useEffect(() => (hydrated ? startAchievements() : undefined), [hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    void initSync();
    initPush();
  }, [hydrated]);
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
