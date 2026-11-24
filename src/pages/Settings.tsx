import { Cloud, Languages, ShieldCheck, Smartphone, Bell, Database, Download, Keyboard, Layers, ListChecks, Palette, Plug, Plus, RotateCcw, Sparkles, Trash2, Upload, User, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandMark, Wordmark } from '@/components/brand';
import { InstallGuide } from '@/components/Install';
import { MOD, Avatar } from '@/components/Shell';
import { Button, Field, Input, Segmented, Switch, Textarea } from '@/components/ui';
import { uploadFiles } from '@/features/assets';
import { BRAND, DEFAULT_EDITING, DEFAULT_PRODUCTION } from '@/lib/constants';
import { migrate } from '@/lib/factories';
import { localFiles } from '@/lib/persistence';
import { buildSample } from '@/lib/sample';
import { snapshot, useStore } from '@/lib/store';
import type { DB, PlatformDef } from '@/lib/types';
import { confirmDialog, toast } from '@/lib/ui';
import { cn, downloadBlob, fmtBytes, uid } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { LANG, LANGS, setLang } from '@/lib/i18n';
import { syncLabel, useSync } from '@/lib/sync';
import { disablePush, enablePush, testPush, usePush } from '@/lib/push';

import { $t } from '@/lib/i18n';
const SECTIONS = [
  { id: 'account', label: $t('Account & sync'), icon: Cloud },
  { id: 'language', label: $t('Language'), icon: Languages },
  { id: 'app', label: $t("App"), icon: Smartphone },
  { id: 'profile', label: $t("Profile"), icon: User },
  { id: 'appearance', label: $t("Appearance"), icon: Palette },
  { id: 'notifications', label: $t("Notifications"), icon: Bell },
  { id: 'platforms', label: $t("Platforms"), icon: Layers },
  { id: 'content', label: $t("Categories & checklists"), icon: ListChecks },
  { id: 'integrations', label: $t("Integrations"), icon: Plug },
  { id: 'data', label: $t("Data & backup"), icon: Database },
  { id: 'shortcuts', label: $t("Shortcuts"), icon: Keyboard },
  { id: 'legal', label: $t('Privacy & legal'), icon: ShieldCheck },
];

function AccountSummary() {
  const { user, status, pending } = useSync();
  if (status === 'unconfigured')
    return <p className="subtle" style={{ fontSize: 13 }}>{$t('KROOPY keeps working on this device. Sync turns on once the KROOPY cloud is connected to this site.')}</p>;
  return (
    <div className="row between wrap gap-12">
      <div style={{ minWidth: 0 }}>
        <b>{user ? user.email : $t('Not signed in')}</b>
        <div className="subtle" style={{ fontSize: 13 }}>{user ? syncLabel(status, pending) : $t('Your data is only on this device.')}</div>
      </div>
      <Link to="/account" className="btn btn--primary">{user ? $t('Manage account') : $t('Sign in or create account')}</Link>
    </div>
  );
}

/** Push notifications for this device — reminders arrive even when KROOPY is closed. */
function PushRow() {
  const { support, enabled, busy, available, permission } = usePush();
  const { user, status } = useSync();
  const [testing, setTesting] = useState(false);
  if (!available || status === 'unconfigured') return null;
  let note: ReactNode;
  let action: ReactNode = null;
  if (support === 'needs-install') note = $t('On iPhone and iPad: in Safari tap Share → Add to Home Screen, open KROOPY from its icon, then turn this on there (iOS 16.4 or later).');
  else if (support === 'unsupported') note = $t('This browser can’t receive notifications. Try Chrome, Edge, Firefox or Safari.');
  else if (!user) {
    note = $t('Sign in so KROOPY knows where to send your reminders.');
    action = <Link to="/account" className="btn btn--sm">{$t('Sign in')}</Link>;
  } else if (permission === 'denied') note = $t('Notifications are blocked for KROOPY. Allow them in your browser or phone settings, then come back.');
  else {
    note = enabled ? $t('On — reminders reach this device even when KROOPY is closed.') : $t('Get reminders for tasks, events, habits and posts on this device, even when KROOPY is closed.');
    action = (
      <div className="row gap-8">
        {enabled && (
          <Button
            size="sm"
            variant="ghost"
            loading={testing}
            onClick={async () => {
              setTesting(true);
              try {
                const n = await testPush();
                toast(n ? $t('Test sent — it should arrive in a few seconds') : $t('Could not reach this device'), { tone: n ? 'success' : 'error' });
              } catch (e) {
                toast($t('Could not send a test'), { tone: 'error', description: (e as Error).message });
              } finally {
                setTesting(false);
              }
            }}
          >
            {$t('Send a test')}
          </Button>
        )}
        <Switch
          checked={enabled}
          disabled={busy}
          label={$t('Push notifications on this device')}
          onChange={async (v) => {
            if (!v) {
              await disablePush();
              return toast($t('Push notifications off on this device'));
            }
            const r = await enablePush();
            if (r === 'ok') toast($t('Push notifications on'), { tone: 'success', description: $t('Reminders will reach this device even when KROOPY is closed.') });
            else if (r === 'denied') toast($t('Permission not granted'), { tone: 'info' });
            else if (r === 'error') toast($t('Could not turn on notifications'), { tone: 'error', description: $t('Check your connection and try again.') });
          }}
        />
      </div>
    );
  }
  return (
    <div className="setting-row">
      <div>
        <b>{$t('Push notifications on this device')}</b>
        <span className="push-row__status">{note}</span>
      </div>
      {action}
    </div>
  );
}

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section id={id} className="settings-section panel">
      <div className="settings-section__head">
        <h2 className="panel__title">{title}</h2>
        {desc && <p className="subtle" style={{ fontSize: 13 }}>{desc}</p>}
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result as string);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const assets = useStore((s) => s.assets);
  const hasDemo = useStore((s) => [s.ideas, s.projects, s.tasks, s.habits, s.analytics, s.events].some((a) => a.some((r) => r.demo)));
  const setSettings = useStore((s) => s.setSettings);
  const store = useStore.getState();
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const importRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {});
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const profile = settings.profile;
  const setProfile = (p: Partial<typeof profile>) => setSettings({ profile: { ...profile, ...p } });

  const exportData = async () => {
    setBusy(true);
    try {
      const db = snapshot();
      const files: Record<string, string> = {};
      let total = 0;
      for (const a of db.assets) {
        if (!a.blobKey) continue;
        const b = await localFiles.get(a.blobKey);
        if (!b) continue;
        total += b.size;
        if (total > 150 * 1024 * 1024) {
          toast($t("Some files were skipped"), { tone: 'info', description: $t("Backups include up to 150 MB of files.") });
          break;
        }
        files[a.blobKey] = await blobToDataUrl(b);
      }
      const payload = { app: 'creator-os', version: db.version, exportedAt: new Date().toISOString(), db, files };
      downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `kroopy-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast($t("Backup downloaded"), { description: $t('{n} files included', { n: Object.keys(files).length }) });
    } catch (e) {
      console.error(e);
      toast($t("Export failed"), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const importData = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      if (json?.app !== 'creator-os' || !json.db) throw new Error('Not a KROOPY backup');
      if (!(await confirmDialog({ title: $t("Replace all data with this backup?"), description: $t('Backup from {date}. Your current data will be overwritten.', { date: new Date(json.exportedAt).toLocaleString() }), confirmLabel: $t("Restore backup") }))) return;
      setBusy(true);
      for (const [key, url] of Object.entries(json.files ?? {})) {
        const blob = await (await fetch(url as string)).blob();
        await localFiles.put(key, blob);
      }
      store.replaceAll(migrate(json.db as DB));
      toast($t("Backup restored"));
    } catch (e) {
      toast($t("Could not import file"), { tone: 'error', description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return toast($t("Notifications are not supported in this browser"), { tone: 'error' });
    const p = await Notification.requestPermission();
    setPerm(p);
    setSettings({ notifications: p === 'granted' });
    toast(p === 'granted' ? $t("Browser notifications enabled") : $t("Permission not granted"), { tone: p === 'granted' ? 'success' : 'info' });
  };

  const updatePlatform = (id: string, patch: Partial<PlatformDef>) => setSettings({ platforms: settings.platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <h1 className="page-title">{$t("Settings")}<span className="stop" /></h1>
          <p className="page-sub">{$t("Your profile, preferences, platforms and data.")}</p>
        </div>
      </header>
      <div className="settings__layout">
        <nav className="settings__nav hide-mobile" aria-label={$t("Settings sections")}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }))}>
              <s.icon size={15} /> {s.label}
            </a>
          ))}
        </nav>
        <div className="settings__content">
          <Section id="account" title={$t('Account & sync')} desc={$t('Sign in on your laptop and your phone to keep the same KROOPY on both.')}>
            <AccountSummary />
          </Section>

          <Section id="language" title={$t('Language')} desc={$t('The whole app, dates included. Saved on this device.')}>
            <Segmented label={$t('Language')} value={LANG} onChange={(l) => l !== LANG && setLang(l)} options={LANGS.map((l) => ({ value: l.id, label: `${l.flag} ${l.label}` }))} />
          </Section>

          <Section id="app" title={$t("KROOPY on your phone")} desc={$t("Install it from the browser to get the KROOPY icon on your home screen, a full-screen app, offline access, a task badge, shortcuts and notifications.")}>
            <InstallGuide />
            <ul className="app-perks">
              <li><b>{$t("Offline")}</b> {$t("Everything is stored on this device — the installed app opens instantly without a connection.")}</li>
              <li><b>{$t("Shortcuts")}</b> {$t("On Android and computers, long-press or right-click the icon for New idea, New video, New task and Calendar.")}</li>
              <li><b>{$t("Share to KROOPY")}</b> {$t("On Android, share a TikTok, reel or link from any app and it lands as a new idea.")}</li>
              <li><b>{$t("Badge")}</b> {$t("The icon shows how many tasks are due today or overdue (after allowing notifications).")}</li>
            </ul>
          </Section>

          <Section id="profile" title={$t("Profile")}>
            <div className="row gap-16" style={{ marginBottom: 16 }}>
              <Avatar size={64} />
              <div className="col" style={{ gap: 6 }}>
                <div className="row">
                  <Button size="sm" icon={<Upload />} onClick={() => avatarRef.current?.click()}>{$t("Upload photo")}</Button>
                  {profile.avatarAssetId && <Button size="sm" variant="ghost" onClick={() => setProfile({ avatarAssetId: undefined })}>{$t("Remove")}</Button>}
                </div>
                <span className="subtle" style={{ fontSize: 12 }}>{$t("Square image recommended. Stored in your Asset Library.")}</span>
              </div>
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const [a] = await uploadFiles([f], { type: 'image', tags: ['avatar'] });
                  if (a) {
                    setProfile({ avatarAssetId: a.id });
                    toast($t("Profile photo updated"));
                  }
                }}
              />
            </div>
            <div className="form-grid">
              <Field label={$t("Name")}><Input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} placeholder={$t("Your name")} /></Field>
              <Field label={$t("Handle")}><Input value={profile.handle} onChange={(e) => setProfile({ handle: e.target.value })} placeholder={$t("@handle")} /></Field>
              <Field label={$t("Role")} className="span-2"><Input value={profile.role} onChange={(e) => setProfile({ role: e.target.value })} /></Field>
            </div>
          </Section>

          <Section id="appearance" title={$t("Appearance")} desc={$t("Saved on this device and applied before the app loads.")}>
            <div className="setting-row">
              <div><b>{$t("Theme")}</b><span>{$t("Dark uses Ink; light uses Ice surfaces.")}</span></div>
              <Segmented label={$t("Theme")} value={settings.theme} onChange={(theme) => setSettings({ theme })} options={[{ value: 'dark', label: $t("Dark") }, { value: 'light', label: $t("Light") }, { value: 'system', label: $t("System") }]} />
            </div>
            <div className="setting-row">
              <div>
                <b>{$t("Liquid glass")}</b>
                <span>{$t("Apple-style refraction (liquid-glass-react) on dialogs, menus, toasts, the command palette, dragged cards and the mobile bars. Full effect in Chromium browsers; Safari and Firefox show frosted glass only. Turn off on slower devices.")}</span>
              </div>
              <Switch checked={settings.liquidGlass !== false} onChange={(v) => setSettings({ liquidGlass: v })} label={$t("Liquid glass")} />
            </div>
            <div className="setting-row">
              <div><b>{$t("Collapsed sidebar")}</b><span>{$t("Icons only, with tooltips.")}</span></div>
              <Switch checked={settings.sidebarCollapsed} onChange={(v) => setSettings({ sidebarCollapsed: v })} label={$t("Collapsed sidebar")} />
            </div>
            <div className="setting-row">
              <div><b>{$t("Week starts on")}</b><span>{$t("Calendar, weekly progress and habits.")}</span></div>
              <Segmented label={$t("Week start")} value={String(settings.weekStartsOn) as '0' | '1'} onChange={(v) => setSettings({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: '1', label: $t("Monday") }, { value: '0', label: $t("Sunday") }]} />
            </div>
          </Section>

          <Section id="notifications" title={$t("Notifications")} desc={$t('Reminders for tasks, events, habits and scheduled posts — on screen while KROOPY is open, and on your phone even when it’s closed.')}>
            <PushRow />
            <div className="setting-row">
              <div>
                <b>{$t("Browser notifications")}</b>
                <span>{perm === 'granted' ? $t("Permission granted — reminders also show as system notifications and the icon shows a task badge.") : perm === 'denied' ? $t("Blocked in your browser settings.") : perm === 'unsupported' ? $t("On iPhone, add KROOPY to your Home Screen first — notifications work in the installed app.") : $t("In-app toasts are always on.")}</span>
              </div>
              {perm === 'granted' ? (
                <Switch checked={settings.notifications} onChange={(v) => setSettings({ notifications: v })} label={$t("Browser notifications")} />
              ) : (
                <Button size="sm" onClick={requestNotifications} disabled={perm === 'denied' || perm === 'unsupported'}>{$t("Enable")}</Button>
              )}
            </div>
          </Section>

          <Section id="platforms" title={$t("Platforms")} desc={$t("Used for planning, calendar colours and analytics. Add any platform you publish on.")}>
            <div className="col" style={{ gap: 6 }}>
              {settings.platforms.map((p) => (
                <div key={p.id} className="platform-row">
                  <input type="color" value={p.color.length === 7 ? p.color : '#2F5BFF'} onChange={(e) => updatePlatform(p.id, { color: e.target.value.toUpperCase() })} aria-label={$t('{name} colour', { name: p.name })} />
                  <Input sm value={p.name} onChange={(e) => updatePlatform(p.id, { name: e.target.value })} aria-label={$t("Platform name")} />
                  <Input sm value={p.short} maxLength={3} onChange={(e) => updatePlatform(p.id, { short: e.target.value.toUpperCase() })} aria-label={$t("Short label")} style={{ width: 64 }} />
                  {p.builtIn ? (
                    <span className="badge" style={{ flex: 'none' }}>{$t("Built-in")}</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={<Trash2 />}
                      aria-label={$t('Remove {name}', { name: p.name })}
                      onClick={async () => {
                        if (await confirmDialog({ title: $t('Remove {name}?', { name: p.name }), description: $t("Videos keep their other platforms.") })) setSettings({ platforms: settings.platforms.filter((x) => x.id !== p.id) });
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <Button size="sm" icon={<Plus />} className="mt-8" onClick={() => setSettings({ platforms: [...settings.platforms, { id: `custom-${uid().slice(0, 8)}`, name: $t("New platform"), short: $t("NP"), color: BRAND.neonLime, builtIn: false }] })}>
              {$t("Add platform")}
            </Button>
          </Section>

          <Section id="content" title={$t("Categories & checklists")}>
            <ListEditor label={$t("Idea & content categories")} value={settings.ideaCategories} onChange={(ideaCategories) => setSettings({ ideaCategories })} />
            <div className="form-grid mt-16">
              <TemplateEditor label={$t("Production checklist template")} value={settings.productionTemplate} fallback={DEFAULT_PRODUCTION} onChange={(productionTemplate) => setSettings({ productionTemplate })} />
              <TemplateEditor label={$t("Editing checklist template")} value={settings.editingTemplate} fallback={DEFAULT_EDITING} onChange={(editingTemplate) => setSettings({ editingTemplate })} />
            </div>
          </Section>

          <Section id="integrations" title={$t("Integrations")} desc={$t("No platform is connected. KROOPY never simulates API data — statistics are entered manually until an official integration is configured.")}>
            <div className="integrations">
              {[
                { name: $t("TikTok"), api: 'TikTok Display API / Research API', color: '#FF0055' },
                { name: $t("Instagram"), api: 'Instagram Graph API (Business/Creator account)', color: BRAND.lime },
                { name: $t("YouTube"), api: 'YouTube Data API v3 + YouTube Analytics API', color: '#8EA6FF' },
              ].map((i) => (
                <div key={i.name} className="integration">
                  <span className="dot" style={{ background: i.color, width: 10, height: 10 }} />
                  <div className="grow">
                    <b>{i.name}</b>
                    <span className="subtle" style={{ fontSize: 12, display: 'block' }}>{i.api}</span>
                  </div>
                  <span className="badge badge--outline">{$t("Not configured · manual entry")}</span>
                </div>
              ))}
            </div>
            <p className="subtle" style={{ fontSize: 12.5, marginTop: 12 }}>
              {$t("Official APIs require OAuth and a server to keep tokens secret, so they arrive with the Supabase backend (")}<code>supabase/migrations/0001_init.sql</code> {$t("already models")} <code>analytics_records.source</code> {$t("and per-platform publications). See the README for the integration plan.")}
            </p>
          </Section>

          <Section id="data" title={$t("Data & backup")} desc={$t("Everything lives in this browser (IndexedDB). Export regularly, or before clearing site data.")}>
            {usage && (
              <div className="setting-row">
                <div><b>{$t("Storage used")}</b><span>{fmtBytes(usage.used)} {$t("of ~")}{fmtBytes(usage.quota)} {$t("available ·")} {assets.filter((a) => a.blobKey).length} {$t("stored files")}</span></div>
              </div>
            )}
            <div className="setting-row">
              <div><b>{$t("Export backup")}</b><span>{$t("JSON file with all records and stored files.")}</span></div>
              <Button size="sm" icon={<Download />} loading={busy} onClick={exportData}>{$t("Export")}</Button>
            </div>
            <div className="setting-row">
              <div><b>{$t("Import backup")}</b><span>{$t("Replaces current data with a KROOPY backup file.")}</span></div>
              <Button size="sm" icon={<Upload />} disabled={busy} onClick={() => importRef.current?.click()}>{$t("Import")}</Button>
              <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importData(f); }} />
            </div>
            <div className="setting-row">
              <div><b>{$t("Sample data")}</b><span>{hasDemo ? $t("Sample records are loaded and flagged — removing them keeps your own data.") : $t("Load clearly-labelled example records to explore the app.")}</span></div>
              {hasDemo ? (
                <Button size="sm" icon={<X />} onClick={() => { store.clearSample(); toast($t("Sample data removed")); }}>{$t("Remove sample data")}</Button>
              ) : (
                <Button size="sm" icon={<Sparkles />} onClick={() => { store.loadSample(buildSample(settings)); toast($t("Sample data loaded")); }}>{$t("Load sample data")}</Button>
              )}
            </div>
            <div className="setting-row setting-row--danger">
              <div><b>{$t("Reset everything")}</b><span>{$t("Permanently deletes all records and files on this device.")}</span></div>
              <Button
                size="sm"
                variant="danger"
                icon={<RotateCcw />}
                onClick={async () => {
                  if (!(await confirmDialog({ title: $t("Reset KROOPY?"), description: $t("All ideas, videos, tasks, trackers, analytics and files will be deleted from this device."), confirmLabel: $t("Reset everything") }))) return;
                  for (const a of assets) if (a.blobKey) await localFiles.remove(a.blobKey);
                  await store.resetAll();
                  toast($t("Workspace reset"));
                }}
              >
                {$t("Reset")}
              </Button>
            </div>
          </Section>

          <Section id="shortcuts" title={$t("Keyboard shortcuts")}>
            <div className="shortcuts">
              {[
                [`${MOD} K`, $t('Command palette & search')],
                ['N', 'Quick create menu'],
                ['/', 'Search'],
                ['I', 'New idea'],
                ['V', 'New video'],
                ['T', 'New task'],
                ['E', 'New event'],
                ['U', 'Upload asset'],
                ['G then O / I / S / C / T', 'Go to Overview, Ideas, Studio, Calendar, Tasks'],
                ['G then R / A / B / L', 'Go to Trackers, Analytics, Brand Kit, Library'],
                ['Esc', 'Close dialogs'],
              ].map(([k, d]) => (
                <div key={k} className="shortcut">
                  <span>{d}</span>
                  <span className="row" style={{ gap: 4 }}>{k!.split(' ').map((x, i) => (x === 'then' || x === '/' && k!.length > 1 && i > 0 ? <span key={i} className="subtle" style={{ fontSize: 11 }}>{x}</span> : <span key={i} className="kbd">{x}</span>))}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="legal" title={$t('Privacy & legal')} desc={$t('No ads, no tracking. Your content is yours.')}>
            <div className="legal-links">
              <Link to="/privacy" className="legal-link">{$t('Privacy Policy')}</Link>
              <Link to="/terms" className="legal-link">{$t('Terms of Use')}</Link>
              <Link to="/cookies" className="legal-link">{$t('Cookies & storage')}</Link>
              <Link to="/support" className="legal-link">{$t('Support')}</Link>
            </div>
          </Section>

          <div className="about">
            <BrandMark size={44} />
            <div className="grow">
              <Wordmark height={20} />
              <p className="subtle" style={{ fontSize: 12, marginTop: 6 }}>{$t("KROOPY 1.0 · local-first (IndexedDB) · works offline · Supabase-ready schema")}</p>
            </div>
            <span className={cn('accent-script')} style={{ color: 'var(--positive-text)', fontSize: 22 }}>{$t("made to create")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListEditor({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || value.includes(v)) return setDraft('');
    onChange([...value, v]);
    setDraft('');
  };
  return (
    <Field label={label} hint={$t("Existing ideas and videos keep their category if you remove it here.")}>
      <div className="chips">
        {value.map((c) => (
          <span key={c} className="chip" style={{ paddingRight: 6 }}>
            {c}
            <button onClick={() => onChange(value.filter((x) => x !== c))} aria-label={`Remove ${c}`} style={{ display: 'inline-flex', color: 'var(--text-3)' }}>
              <X size={13} />
            </button>
          </span>
        ))}
        <form onSubmit={(e) => (e.preventDefault(), add())} className="row" style={{ gap: 4 }}>
          <input className="input input--sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={$t("Add category")} style={{ width: 150, height: 30 }} aria-label={$t("New category")} />
        </form>
      </div>
    </Field>
  );
}

function TemplateEditor({ label, value, fallback, onChange }: { label: string; value: string[]; fallback: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <Field label={label} hint={$t("One step per line. Applied to new videos.")} aside={<button className="link-btn" onClick={() => { setText(fallback.join('\n')); onChange(fallback); }}>{$t("Reset")}</button>}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.split('\n').map((s) => s.trim()).filter(Boolean))} style={{ minHeight: 190 }} />
    </Field>
  );
}
