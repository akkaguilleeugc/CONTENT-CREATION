import {
  Bell,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Home,
  Languages,
  Menu as MenuIcon,
  Moon,
  Plus,
  Search,
  Sun,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAsset, useAssetUrl, useNow } from '@/lib/hooks';
import { notices } from '@/lib/metrics';
import { snapshot, useStore } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { cn, initials, todayStr } from '@/lib/utils';
import { BrandMark, Wordmark } from './brand';
import { CustomCursor, PointerGlow } from './PointerFX';
import { GlassSurface } from './Glass';
import { NAV, NAV_GROUPS, titleFor } from './nav';
import { Menu, Modal, Popover, usePopover } from './overlay';
import { syncLabel, useSync } from '@/lib/sync';
import { LANG, LANGS, setLang } from '@/lib/i18n';
import { Button } from './ui';

import { $t } from '@/lib/i18n';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

export const resolveTheme = (t: 'dark' | 'light' | 'system'): 'dark' | 'light' =>
  t === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;

export function Avatar({ size = 34 }: { size?: number }) {
  const profile = useStore((s) => s.settings.profile);
  const asset = useAsset(profile.avatarAssetId);
  const url = useAssetUrl(asset);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {url ? <img src={url} alt="" /> : initials(profile.name || 'Creator')}
    </span>
  );
}

function useNavCounts() {
  const ideas = useStore((s) => s.ideas);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  return useMemo(() => {
    const today = todayStr();
    return {
      '/ideas': { n: ideas.filter((i) => i.status === 'inbox').length, hot: false },
      '/tasks': { n: tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= today).length, hot: true },
      '/studio': { n: projects.filter((p) => ['recording', 'editing', 'review'].includes(p.stage)).length, hot: false },
    } as Record<string, { n: number; hot: boolean }>;
  }, [ideas, tasks, projects]);
}

/** Language switch (English · Español · Português do Brasil). */
export function LanguageMenu({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cur = LANGS.find((l) => l.id === LANG)!;
  return (
    <Menu
      align="end"
      width={220}
      items={LANGS.map((l) => ({ label: `${l.flag}  ${l.label}${l.id === LANG ? '  ✓' : ''}`, onSelect: () => l.id !== LANG && setLang(l.id) }))}
      trigger={(t) => (
        <button {...t} className={cn('lang-btn', size === 'md' && 'lang-btn--md')} aria-label={$t('Language')} data-tip={$t('Language')}>
          <Languages />
          <span>{cur.short}</span>
        </button>
      )}
    />
  );
}

export function ThemeToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const resolved = resolveTheme(theme);
  return (
    <Button
      variant="ghost"
      size={size}
      iconOnly
      tip={resolved === 'dark' ? $t("Light mode") : $t("Dark mode")}
      icon={resolved === 'dark' ? <Sun /> : <Moon />}
      onClick={() => setSettings({ theme: resolved === 'dark' ? 'light' : 'dark' })}
      aria-label={$t('Switch theme (current: {theme})', { theme })}
    />
  );
}

export function NotificationsButton() {
  const now = useNow(30_000);
  const state = useStore();
  const items = useMemo(() => (state.hydrated ? notices(snapshot(state), now) : []), [state, now]);
  const pop = usePopover();
  const navigate = useNavigate();
  return (
    <>
      <span className="bell">
        <Button
          variant="ghost"
          iconOnly
          tip={$t("Notifications")}
          tipSide="bottom"
          icon={<Bell />}
          onClick={(e) => pop.toggle(e.currentTarget)}
          aria-label={`${$t('Notifications')}${items.length ? ` (${items.length})` : ''}`}
        />
        {items.length > 0 && <span className="bell__dot" aria-hidden />}
      </span>
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={340}>
        <div className="menu__label">{$t("Notifications")}</div>
        {items.length === 0 ? (
          <div style={{ padding: '14px 10px 16px', color: 'var(--text-3)', fontSize: 13 }}>{$t("You’re all caught up. Nothing overdue or due soon.")}</div>
        ) : (
          items.map((n) => (
            <button
              key={n.key}
              className={cn('notice', `notice--${n.tone}`)}
              onClick={() => {
                pop.close();
                navigate(n.href);
              }}
            >
              <span className="notice__bar" />
              <span style={{ minWidth: 0 }}>
                <div className="notice__title">{n.title}</div>
                <div className="notice__detail truncate">{n.detail}</div>
              </span>
            </button>
          ))
        )}
      </Popover>
    </>
  );
}

function Sidebar() {
  const collapsed = useStore((s) => s.settings.sidebarCollapsed);
  const setSettings = useStore((s) => s.setSettings);
  const profile = useStore((s) => s.settings.profile);
  const saveState = useStore((s) => s.saveState);
  const { user: syncUser, status: syncStatus, pending: syncPending } = useSync();
  const counts = useNavCounts();
  const { setPalette, setQuick } = useUI();
  const loc = useLocation();
  const isActive = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const tip = (label: string) => (collapsed ? label : undefined);

  const item = (n: (typeof NAV)[number]) => {
    const c = counts[n.to];
    return (
      <NavLink key={n.to} to={n.to} className={cn('nav__item', isActive(n.to) && 'nav__item--active')} data-tip={tip(n.label)} data-tip-side="right" aria-label={n.label}>
        <n.icon />
        <span className="nav__text">{n.label}</span>
        {c && c.n > 0 && <span className={cn('nav__count', c.hot && 'nav__count--hot')}>{c.n}</span>}
      </NavLink>
    );
  };

  return (
    <aside className={cn('sidebar', collapsed && 'sidebar--collapsed')} aria-label={$t("Main navigation")}>
      <button className="sidebar__collapse-floating" onClick={() => setSettings({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? $t("Expand sidebar") : $t("Collapse sidebar")}>
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>
      <Link to="/" className="sidebar__brand" aria-label={$t("KROOPY home")}>
        <BrandMark />
        <span className="brand-word">
          <Wordmark height={25} plate="none" tone="auto" />
          <span className="brand-word__product">
            {$t("Creator")}<em>studio</em>
          </span>
        </span>
      </Link>
      <div className="sidebar__actions">
        <Button variant="primary" block icon={<Plus />} onClick={() => setQuick(true)} tip={tip('Create')} tipSide="right" aria-label={$t("Create")}>
          <span className="btn-label">{$t("Create")}</span>
        </Button>
        <button className="search-trigger" onClick={() => setPalette(true)} data-tip={tip(`Search ${MOD}K`)} data-tip-side="right" aria-label={$t("Search and commands")}>
          <Search />
          <span>{$t("Search or jump to…")}</span>
          <span className="kbd">{MOD}K</span>
        </button>
      </div>
      <nav className="nav">
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className="nav__group">
            <div className="nav__label">{g.label}</div>
            {NAV.filter((n) => n.group === g.id).map(item)}
          </div>
        ))}
      </nav>
      <div className="sidebar__foot">
        {item(NAV.find((n) => n.to === '/settings')!)}
        <div className="row sidebar__foot-row" style={{ gap: 4 }}>
          <Link to="/settings" className="profile-chip grow" aria-label={$t("Profile settings")}>
            <Avatar />
            <span className="profile-chip__meta" style={{ minWidth: 0 }}>
              <div className="profile-chip__name truncate">{profile.name || $t("Creator")}</div>
              <div className="profile-chip__sub">
                <span className={cn('save-dot', (saveState === 'saving' || syncStatus === 'syncing') && 'save-dot--saving', (saveState === 'error' || (syncUser && syncStatus === 'error')) && 'save-dot--error', syncUser && syncStatus === 'offline' && 'save-dot--offline')} />
                {saveState === 'saving' ? $t("Saving…") : saveState === 'error' ? $t("Save failed") : syncUser ? syncLabel(syncStatus, syncPending) : $t("Saved locally")}
              </div>
            </span>
          </Link>
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  const loc = useLocation();
  const { setPalette, setMore } = useUI();
  return (
    <GlassSurface as="header" radius={22} tone="chrome" className="topbar">
      <Link to="/" aria-label={$t("Home")}>
        <BrandMark />
      </Link>
      <div className="topbar__title">{titleFor(loc.pathname)}</div>
      <Button variant="ghost" iconOnly icon={<Search />} onClick={() => setPalette(true)} aria-label={$t("Search")} />
      <NotificationsButton />
      <Button variant="ghost" iconOnly icon={<MenuIcon />} onClick={() => setMore(true)} aria-label={$t("More sections")} />
    </GlassSurface>
  );
}

const PRIMARY_MOBILE = ['/', '/studio', '/calendar'];

function BottomNav() {
  const loc = useLocation();
  const { setQuick, setMore, moreOpen } = useUI();
  const isActive = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const tab = (to: string, label: string, icon: ReactNode) => (
    <NavLink to={to} className={cn('bottomnav__item', isActive(to) && !moreOpen && 'bottomnav__item--active')}>
      {icon}
      {label}
    </NavLink>
  );
  const Studio = NAV.find((n) => n.to === '/studio')!.icon;
  const Cal = NAV.find((n) => n.to === '/calendar')!.icon;
  const inMore = !PRIMARY_MOBILE.some((p) => isActive(p));
  return (
    <GlassSurface as="nav" radius={30} tone="chrome" className="bottomnav" aria-label={$t("Primary")}>
      {tab('/', $t('Home'), <Home />)}
      {tab('/studio', $t('Studio'), <Studio />)}
      <button className="bottomnav__fab" onClick={() => setQuick(true)} aria-label={$t("Create")}>
        <Plus />
      </button>
      {tab('/calendar', $t('Calendar'), <Cal />)}
      <button className={cn('bottomnav__item', (inMore || moreOpen) && 'bottomnav__item--active')} onClick={() => setMore(true)}>
        <MenuIcon />
        {$t("More")}
      </button>
    </GlassSurface>
  );
}

function MoreSheet() {
  const { moreOpen, setMore } = useUI();
  const loc = useLocation();
  const counts = useNavCounts();
  const navigate = useNavigate();
  return (
    <Modal open={moreOpen} onClose={() => setMore(false)} title={$t("All sections")} description={$t("Everything in KROOPY.")} initialFocus={false}>
      <div className="more-grid">
        {NAV.filter((n) => !PRIMARY_MOBILE.includes(n.to)).map((n) => (
          <button
            key={n.to}
            className={cn('more-tile', loc.pathname.startsWith(n.to) && 'more-tile--active')}
            onClick={() => {
              setMore(false);
              navigate(n.to);
            }}
          >
            <n.icon />
            <span className="row between" style={{ width: '100%' }}>
              {n.label}
              {counts[n.to]?.n ? <span className={cn('nav__count', counts[n.to]!.hot && 'nav__count--hot')}>{counts[n.to]!.n}</span> : null}
            </span>
          </button>
        ))}
        <button className={cn('more-tile', loc.pathname === '/account' && 'more-tile--active')} onClick={() => { setMore(false); navigate('/account'); }}>
          <Cloud />
          <span>{$t('Account & sync')}</span>
        </button>
      </div>
      <div className="row between mt-16">
        <span className="subtle" style={{ fontSize: 13 }}>{$t('Language')}</span>
        <LanguageMenu size="md" />
      </div>
      <div className="row between mt-16" style={{ paddingBottom: 8 }}>
        <span className="subtle" style={{ fontSize: 13 }}>{$t("Theme")}</span>
        <ThemeToggle size="md" />
      </div>
      <p className="subtle more-legal">
        <Link to="/privacy" onClick={() => setMore(false)}>{$t('Privacy')}</Link> · <Link to="/terms" onClick={() => setMore(false)}>{$t('Terms')}</Link> · <Link to="/cookies" onClick={() => setMore(false)}>{$t('Cookies')}</Link> · <Link to="/support" onClick={() => setMore(false)}>{$t('Support')}</Link>
      </p>
    </Modal>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const collapsed = useStore((s) => s.settings.sidebarCollapsed);
  return (
    <div className={cn('app', collapsed && 'app--collapsed')}>
      <PointerGlow />
      <Sidebar />
      <Topbar />
      <main className="app__main" id="main">
        {children}
      </main>
      <BottomNav />
      <MoreSheet />
      <CustomCursor />
    </div>
  );
}
