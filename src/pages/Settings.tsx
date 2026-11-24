import { Bell, Database, Download, Keyboard, Layers, ListChecks, Palette, Plug, Plus, RotateCcw, Sparkles, Trash2, Upload, User, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandMark, Wordmark } from '@/components/brand';
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

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'platforms', label: 'Platforms', icon: Layers },
  { id: 'content', label: 'Categories & checklists', icon: ListChecks },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'data', label: 'Data & backup', icon: Database },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

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
          toast('Some files were skipped', { tone: 'info', description: 'Backups include up to 150 MB of files.' });
          break;
        }
        files[a.blobKey] = await blobToDataUrl(b);
      }
      const payload = { app: 'creator-os', version: db.version, exportedAt: new Date().toISOString(), db, files };
      downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `creator-os-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Backup downloaded', { description: `${Object.keys(files).length} files included` });
    } catch (e) {
      console.error(e);
      toast('Export failed', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const importData = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      if (json?.app !== 'creator-os' || !json.db) throw new Error('Not a Creator OS backup');
      if (!(await confirmDialog({ title: 'Replace all data with this backup?', description: `Backup from ${new Date(json.exportedAt).toLocaleString()}. Your current data will be overwritten.`, confirmLabel: 'Restore backup' }))) return;
      setBusy(true);
      for (const [key, url] of Object.entries(json.files ?? {})) {
        const blob = await (await fetch(url as string)).blob();
        await localFiles.put(key, blob);
      }
      store.replaceAll(migrate(json.db as DB));
      toast('Backup restored');
    } catch (e) {
      toast('Could not import file', { tone: 'error', description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return toast('Notifications are not supported in this browser', { tone: 'error' });
    const p = await Notification.requestPermission();
    setPerm(p);
    setSettings({ notifications: p === 'granted' });
    toast(p === 'granted' ? 'Browser notifications enabled' : 'Permission not granted', { tone: p === 'granted' ? 'success' : 'info' });
  };

  const updatePlatform = (id: string, patch: Partial<PlatformDef>) => setSettings({ platforms: settings.platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <h1 className="page-title">Settings<span className="stop" /></h1>
          <p className="page-sub">Your profile, preferences, platforms and data.</p>
        </div>
      </header>
      <div className="settings__layout">
        <nav className="settings__nav hide-mobile" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }))}>
              <s.icon size={15} /> {s.label}
            </a>
          ))}
        </nav>
        <div className="settings__content">
          <Section id="profile" title="Profile">
            <div className="row gap-16" style={{ marginBottom: 16 }}>
              <Avatar size={64} />
              <div className="col" style={{ gap: 6 }}>
                <div className="row">
                  <Button size="sm" icon={<Upload />} onClick={() => avatarRef.current?.click()}>Upload photo</Button>
                  {profile.avatarAssetId && <Button size="sm" variant="ghost" onClick={() => setProfile({ avatarAssetId: undefined })}>Remove</Button>}
                </div>
                <span className="subtle" style={{ fontSize: 12 }}>Square image recommended. Stored in your Asset Library.</span>
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
                    toast('Profile photo updated');
                  }
                }}
              />
            </div>
            <div className="form-grid">
              <Field label="Name"><Input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} placeholder="Your name" /></Field>
              <Field label="Handle"><Input value={profile.handle} onChange={(e) => setProfile({ handle: e.target.value })} placeholder="@handle" /></Field>
              <Field label="Role" className="span-2"><Input value={profile.role} onChange={(e) => setProfile({ role: e.target.value })} /></Field>
            </div>
          </Section>

          <Section id="appearance" title="Appearance" desc="Saved on this device and applied before the app loads.">
            <div className="setting-row">
              <div><b>Theme</b><span>Dark uses Ink; light uses Ice surfaces.</span></div>
              <Segmented label="Theme" value={settings.theme} onChange={(theme) => setSettings({ theme })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
            </div>
            <div className="setting-row">
              <div>
                <b>Liquid glass</b>
                <span>Apple-style refraction (liquid-glass-react) on dialogs, menus, toasts, the command palette, dragged cards and the mobile bars. Full effect in Chromium browsers; Safari and Firefox show frosted glass only. Turn off on slower devices.</span>
              </div>
              <Switch checked={settings.liquidGlass !== false} onChange={(v) => setSettings({ liquidGlass: v })} label="Liquid glass" />
            </div>
            <div className="setting-row">
              <div><b>Collapsed sidebar</b><span>Icons only, with tooltips.</span></div>
              <Switch checked={settings.sidebarCollapsed} onChange={(v) => setSettings({ sidebarCollapsed: v })} label="Collapsed sidebar" />
            </div>
            <div className="setting-row">
              <div><b>Week starts on</b><span>Calendar, weekly progress and habits.</span></div>
              <Segmented label="Week start" value={String(settings.weekStartsOn) as '0' | '1'} onChange={(v) => setSettings({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
            </div>
          </Section>

          <Section id="notifications" title="Notifications" desc="Reminders for tasks, events, habits and scheduled posts fire while Creator OS is open.">
            <div className="setting-row">
              <div>
                <b>Browser notifications</b>
                <span>{perm === 'granted' ? 'Permission granted.' : perm === 'denied' ? 'Blocked in your browser settings.' : perm === 'unsupported' ? 'Not supported in this browser.' : 'In-app toasts are always on.'}</span>
              </div>
              {perm === 'granted' ? (
                <Switch checked={settings.notifications} onChange={(v) => setSettings({ notifications: v })} label="Browser notifications" />
              ) : (
                <Button size="sm" onClick={requestNotifications} disabled={perm === 'denied' || perm === 'unsupported'}>Enable</Button>
              )}
            </div>
          </Section>

          <Section id="platforms" title="Platforms" desc="Used for planning, calendar colours and analytics. Add any platform you publish on.">
            <div className="col" style={{ gap: 6 }}>
              {settings.platforms.map((p) => (
                <div key={p.id} className="platform-row">
                  <input type="color" value={p.color.length === 7 ? p.color : '#2F5BFF'} onChange={(e) => updatePlatform(p.id, { color: e.target.value.toUpperCase() })} aria-label={`${p.name} colour`} />
                  <Input sm value={p.name} onChange={(e) => updatePlatform(p.id, { name: e.target.value })} aria-label="Platform name" />
                  <Input sm value={p.short} maxLength={3} onChange={(e) => updatePlatform(p.id, { short: e.target.value.toUpperCase() })} aria-label="Short label" style={{ width: 64 }} />
                  {p.builtIn ? (
                    <span className="badge" style={{ flex: 'none' }}>Built-in</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      icon={<Trash2 />}
                      aria-label={`Remove ${p.name}`}
                      onClick={async () => {
                        if (await confirmDialog({ title: `Remove ${p.name}?`, description: 'Videos keep their other platforms.' })) setSettings({ platforms: settings.platforms.filter((x) => x.id !== p.id) });
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <Button size="sm" icon={<Plus />} className="mt-8" onClick={() => setSettings({ platforms: [...settings.platforms, { id: `custom-${uid().slice(0, 8)}`, name: 'New platform', short: 'NP', color: BRAND.neonLime, builtIn: false }] })}>
              Add platform
            </Button>
          </Section>

          <Section id="content" title="Categories & checklists">
            <ListEditor label="Idea & content categories" value={settings.ideaCategories} onChange={(ideaCategories) => setSettings({ ideaCategories })} />
            <div className="form-grid mt-16">
              <TemplateEditor label="Production checklist template" value={settings.productionTemplate} fallback={DEFAULT_PRODUCTION} onChange={(productionTemplate) => setSettings({ productionTemplate })} />
              <TemplateEditor label="Editing checklist template" value={settings.editingTemplate} fallback={DEFAULT_EDITING} onChange={(editingTemplate) => setSettings({ editingTemplate })} />
            </div>
          </Section>

          <Section id="integrations" title="Integrations" desc="No platform is connected. Creator OS never simulates API data — statistics are entered manually until an official integration is configured.">
            <div className="integrations">
              {[
                { name: 'TikTok', api: 'TikTok Display API / Research API', color: '#FF0055' },
                { name: 'Instagram', api: 'Instagram Graph API (Business/Creator account)', color: BRAND.lime },
                { name: 'YouTube', api: 'YouTube Data API v3 + YouTube Analytics API', color: '#8EA6FF' },
              ].map((i) => (
                <div key={i.name} className="integration">
                  <span className="dot" style={{ background: i.color, width: 10, height: 10 }} />
                  <div className="grow">
                    <b>{i.name}</b>
                    <span className="subtle" style={{ fontSize: 12, display: 'block' }}>{i.api}</span>
                  </div>
                  <span className="badge badge--outline">Not configured · manual entry</span>
                </div>
              ))}
            </div>
            <p className="subtle" style={{ fontSize: 12.5, marginTop: 12 }}>
              Official APIs require OAuth and a server to keep tokens secret, so they arrive with the Supabase backend (<code>supabase/migrations/0001_init.sql</code> already models <code>analytics_records.source</code> and per-platform publications). See the README for the integration plan.
            </p>
          </Section>

          <Section id="data" title="Data & backup" desc="Everything lives in this browser (IndexedDB). Export regularly, or before clearing site data.">
            {usage && (
              <div className="setting-row">
                <div><b>Storage used</b><span>{fmtBytes(usage.used)} of ~{fmtBytes(usage.quota)} available · {assets.filter((a) => a.blobKey).length} stored files</span></div>
              </div>
            )}
            <div className="setting-row">
              <div><b>Export backup</b><span>JSON file with all records and stored files.</span></div>
              <Button size="sm" icon={<Download />} loading={busy} onClick={exportData}>Export</Button>
            </div>
            <div className="setting-row">
              <div><b>Import backup</b><span>Replaces current data with a Creator OS backup file.</span></div>
              <Button size="sm" icon={<Upload />} disabled={busy} onClick={() => importRef.current?.click()}>Import</Button>
              <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importData(f); }} />
            </div>
            <div className="setting-row">
              <div><b>Sample data</b><span>{hasDemo ? 'Sample records are loaded and flagged — removing them keeps your own data.' : 'Load clearly-labelled example records to explore the app.'}</span></div>
              {hasDemo ? (
                <Button size="sm" icon={<X />} onClick={() => { store.clearSample(); toast('Sample data removed'); }}>Remove sample data</Button>
              ) : (
                <Button size="sm" icon={<Sparkles />} onClick={() => { store.loadSample(buildSample(settings)); toast('Sample data loaded'); }}>Load sample data</Button>
              )}
            </div>
            <div className="setting-row setting-row--danger">
              <div><b>Reset everything</b><span>Permanently deletes all records and files on this device.</span></div>
              <Button
                size="sm"
                variant="danger"
                icon={<RotateCcw />}
                onClick={async () => {
                  if (!(await confirmDialog({ title: 'Reset Creator OS?', description: 'All ideas, videos, tasks, trackers, analytics and files will be deleted from this device.', confirmLabel: 'Reset everything' }))) return;
                  for (const a of assets) if (a.blobKey) await localFiles.remove(a.blobKey);
                  await store.resetAll();
                  toast('Workspace reset');
                }}
              >
                Reset
              </Button>
            </div>
          </Section>

          <Section id="shortcuts" title="Keyboard shortcuts">
            <div className="shortcuts">
              {[
                [`${MOD} K`, 'Command palette & search'],
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

          <div className="about">
            <BrandMark size={44} />
            <div className="grow">
              <Wordmark height={20} />
              <p className="subtle" style={{ fontSize: 12, marginTop: 6 }}>Creator OS 1.0 · local-first (IndexedDB) · Supabase-ready schema</p>
            </div>
            <span className={cn('accent-script')} style={{ color: 'var(--positive-text)', fontSize: 22 }}>made to create</span>
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
    <Field label={label} hint="Existing ideas and videos keep their category if you remove it here.">
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
          <input className="input input--sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add category" style={{ width: 150, height: 30 }} aria-label="New category" />
        </form>
      </div>
    </Field>
  );
}

function TemplateEditor({ label, value, fallback, onChange }: { label: string; value: string[]; fallback: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <Field label={label} hint="One step per line. Applied to new videos." aside={<button className="link-btn" onClick={() => { setText(fallback.join('\n')); onChange(fallback); }}>Reset</button>}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.split('\n').map((s) => s.trim()).filter(Boolean))} style={{ minHeight: 190 }} />
    </Field>
  );
}
