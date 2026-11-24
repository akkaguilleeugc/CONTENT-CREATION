import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  FileText,
  Film,
  ImageIcon,
  Lightbulb,
  Link2,
  ListChecks,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Scissors,
  Send,
  Timer,
  Trash2,
  Unlink,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProgressBar, ProgressRing } from '@/components/charts';
import { EmptyState, Menu } from '@/components/overlay';
import { Button, Checkbox, ChipToggle, Field, Input, PriorityTag, Segmented, Select, TagInput, Tabs, Textarea } from '@/components/ui';
import { AssetThumb, Dropzone, uploadFiles } from '@/features/assets';
import { FORMATS, PRIORITIES, SHOT_TYPES, STAGES, stageIndex } from '@/lib/constants';
import { newTask } from '@/lib/factories';
import { projectProgress, sumRecords } from '@/lib/metrics';
import { flushPendingSave, useStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import type { ChecklistItem, ContentProject, Priority, Shot, Stage } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, compact, copyText, fmtDate, fmtMinutes, relativeDay, todayStr, uid, wordCount } from '@/lib/utils';

import { $t } from '@/lib/i18n';
type Tab = 'overview' | 'concept' | 'script' | 'shots' | 'production' | 'editing' | 'publish' | 'files';

/** Local draft over the stored project with debounced autosave. */
function useProjectDraft(id: string) {
  const project = useStore((s) => s.projects.find((p) => p.id === id));
  const [pending, setPending] = useState<Partial<ContentProject>>({});
  const pendingRef = useRef<Partial<ContentProject>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (Object.keys(pendingRef.current).length) {
      useStore.getState().update('projects', id, pendingRef.current);
      pendingRef.current = {};
      setPending({});
    }
  };
  const patch = (p: Partial<ContentProject>, immediate = false) => {
    pendingRef.current = { ...pendingRef.current, ...p };
    setPending(pendingRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, immediate ? 0 : 600);
  };
  useEffect(() => {
    // Commit unsaved typing if the tab is hidden, closed or reloaded.
    const onHide = () => {
      flush();
      flushPendingSave();
    };
    const onVis = () => document.visibilityState === 'hidden' && onHide();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVis);
      flush();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = project ? ({ ...project, ...pending } as ContentProject) : undefined;
  return { view, patch, flush, dirty: Object.keys(pending).length > 0 };
}

export default function Workspace() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { view: p, patch, flush, dirty } = useProjectDraft(id);
  const [tab, setTab] = useState<Tab>('overview');
  const saveState = useStore((s) => s.saveState);

  if (!p)
    return (
      <div className="page">
        <EmptyState icon={<Clapperboard />} title={$t("Video not found")} text={$t("It may have been deleted.")} actions={<Button onClick={() => navigate('/studio')}>{$t("Back to Content Studio")}</Button>} />
      </div>
    );

  const store = useStore.getState();
  const idx = stageIndex(p.stage);
  const setStage = (s: Stage) => {
    flush();
    store.setStage(p.id, s);
    if (s === 'published') toast($t("Marked as published"), { description: $t("Log its statistics in Analytics when numbers come in."), action: { label: $t("Log stats"), run: () => openModal({ kind: 'stats', defaults: { projectId: p.id } }) } });
  };
  const prog = projectProgress(p);
  const shotsDone = p.shots.filter((s) => s.status !== 'pending').length;

  const tabs: { value: Tab; label: string; icon: ReactNode; count?: string }[] = [
    { value: 'overview', label: $t("Overview"), icon: <Clapperboard /> },
    { value: 'concept', label: $t("Concept"), icon: <Lightbulb /> },
    { value: 'script', label: $t("Script"), icon: <FileText /> },
    { value: 'shots', label: $t("Shot list"), icon: <Film />, count: p.shots.length ? `${shotsDone}/${p.shots.length}` : undefined },
    { value: 'production', label: $t("Production"), icon: <ListChecks />, count: `${p.production.filter((c) => c.done).length}/${p.production.length}` },
    { value: 'editing', label: $t("Editing"), icon: <Scissors />, count: `${p.editing.filter((c) => c.done).length}/${p.editing.length}` },
    { value: 'publish', label: $t("Publishing"), icon: <Send /> },
    { value: 'files', label: $t("Files"), icon: <ImageIcon />, count: p.assetIds.length ? String(p.assetIds.length) : undefined },
  ];

  return (
    <div className="page ws">
      <div className="ws__top">
        <Link to="/studio" className="ws__back">
          <ArrowLeft size={15} /> {$t("Content Studio")}
        </Link>
        <span className={cn('ws__save', (dirty || saveState === 'saving') && 'ws__save--busy')}>
          <span className={cn('save-dot', (dirty || saveState === 'saving') && 'save-dot--saving')} />
          {dirty || saveState === 'saving' ? $t("Saving…") : $t("All changes saved")}
        </span>
      </div>

      <header className="ws__head">
        <div className="grow">
          <input className="ws__title" value={p.title} onChange={(e) => patch({ title: e.target.value })} placeholder={$t("Untitled video")} aria-label={$t("Video title")} onBlur={flush} />
          <div className="ws__meta">
            <PriorityTag p={p.priority} />
            <span className="subtle">·</span>
            <span className="subtle">{FORMATS.find((f) => f.id === p.format)?.label}</span>
            <span className="subtle">·</span>
            <span className="subtle">{p.category}</span>
            {p.publishDate && (
              <>
                <span className="subtle">·</span>
                <span className="badge badge--outline">
                  <Send /> {relativeDay(p.publishDate)}
                  {p.publishTime ? ` ${p.publishTime}` : ''}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="row">
          <Menu
            items={[
              { label: $t("Log statistics"), icon: <BarChart3 />, onSelect: () => openModal({ kind: 'stats', defaults: { projectId: p.id } }) },
              { label: $t("Log time"), icon: <Timer />, onSelect: () => openModal({ kind: 'timelog', defaults: { projectId: p.id } }) },
              {
                label: $t("Duplicate"),
                icon: <Copy />,
                onSelect: () => {
                  flush();
                  const c = store.duplicateProject(p.id);
                  if (c) {
                    toast($t("Video duplicated"));
                    navigate(`/studio/${c.id}`);
                  }
                },
              },
              {
                label: $t("Delete video"),
                icon: <Trash2 />,
                danger: true,
                separator: true,
                onSelect: async () => {
                  if (await confirmDialog({ title: $t('Delete “{name}”?', { name: p.title || $t('Untitled') }), description: $t("Script, shots and checklists are deleted. Linked tasks, events and files are kept.") })) {
                    store.deleteProject(p.id);
                    toast($t("Video deleted"));
                    navigate('/studio');
                  }
                },
              },
            ]}
            trigger={(t) => <Button {...t} iconOnly icon={<MoreHorizontal />} aria-label={$t("More actions")} />}
          />
        </div>
      </header>

      <div className="stepper" role="group" aria-label={$t("Production stage")}>
        <Button variant="ghost" size="sm" iconOnly icon={<ChevronLeft />} disabled={idx === 0} onClick={() => setStage(STAGES[idx - 1]!.id)} aria-label={$t("Previous stage")} />
        <div className="stepper__track">
          {STAGES.map((s, i) => (
            <button key={s.id} className={cn('stepper__step', i < idx && 'stepper__step--done', i === idx && 'stepper__step--on')} onClick={() => setStage(s.id)} aria-current={i === idx ? 'step' : undefined} aria-label={s.label}>
              <span className="stepper__dot">{i < idx ? <Check /> : i + 1}</span>
              <span className="stepper__label">{s.label}</span>
            </button>
          ))}
        </div>
        <Button variant={idx === STAGES.length - 2 ? 'lime' : 'primary'} size="sm" disabled={idx === STAGES.length - 1} onClick={() => setStage(STAGES[idx + 1]!.id)} icon={<ChevronRight />}>
          <span className="hide-mobile">{idx < STAGES.length - 1 ? STAGES[idx + 1]!.label : $t("Done")}</span>
        </Button>
      </div>

      <div className="ws__grid">
        <div className="ws__main">
          <Tabs value={tab} onChange={setTab} tabs={tabs} className="ws__tabs" />
          <div className="ws__panel panel" key={tab}>
            {tab === 'overview' && <OverviewTab p={p} patch={patch} />}
            {tab === 'concept' && <ConceptTab p={p} patch={patch} />}
            {tab === 'script' && <ScriptTab p={p} patch={patch} />}
            {tab === 'shots' && <ShotsTab p={p} patch={patch} />}
            {tab === 'production' && <ChecklistTab title={$t("Production checklist")} items={p.production} onChange={(production) => patch({ production }, true)} template={store.settings.productionTemplate} />}
            {tab === 'editing' && <ChecklistTab title={$t("Editing checklist")} items={p.editing} onChange={(editing) => patch({ editing }, true)} template={store.settings.editingTemplate} />}
            {tab === 'publish' && <PublishTab p={p} patch={patch} onPublish={() => setStage('published')} />}
            {tab === 'files' && <FilesTab p={p} />}
          </div>
        </div>
        <Aside p={p} prog={prog} />
      </div>
    </div>
  );
}

type TabProps = { p: ContentProject; patch: (x: Partial<ContentProject>, immediate?: boolean) => void };

function OverviewTab({ p, patch }: TabProps) {
  const platforms = useStore((s) => s.settings.platforms);
  const categories = useStore((s) => s.settings.ideaCategories);
  const [mins, setMins] = useState(p.duration ? String(Math.round(p.duration / 6) / 10) : '');
  return (
    <div className="form">
      <Field label={$t("Description")}>
        <Textarea autoGrow value={p.description} onChange={(e) => patch({ description: e.target.value })} placeholder={$t("What is this video about?")} />
      </Field>
      <div className="form-grid">
        <Field label={$t("Platforms")} className="span-2">
          <ChipToggle options={platforms.map((x) => ({ value: x.id, label: x.name, color: x.color }))} value={p.platformIds} onChange={(platformIds) => patch({ platformIds }, true)} />
        </Field>
        <Field label={$t("Format")}>
          <Select value={p.format} onChange={(e) => patch({ format: e.target.value as ContentProject['format'] }, true)} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
        </Field>
        <Field label={$t("Category")}>
          <Select value={p.category} onChange={(e) => patch({ category: e.target.value }, true)} options={Array.from(new Set([...categories, p.category])).map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label={$t("Goal of the video")} className="span-2">
          <Input value={p.goal} onChange={(e) => patch({ goal: e.target.value })} placeholder={$t("Grow followers, drive saves, sell, entertain…")} />
        </Field>
        <Field label={$t("Publish date")}>
          <Input type="date" value={p.publishDate ?? ''} onChange={(e) => patch({ publishDate: e.target.value || undefined }, true)} />
        </Field>
        <Field label={$t("Publish time")}>
          <Input type="time" value={p.publishTime ?? ''} onChange={(e) => patch({ publishTime: e.target.value || undefined }, true)} />
        </Field>
        <Field label={$t("Recording day")} hint={$t("Shows on the calendar.")}>
          <Input type="date" value={p.recordDate ?? ''} onChange={(e) => patch({ recordDate: e.target.value || undefined }, true)} />
        </Field>
        <Field label={$t("Editing day")}>
          <Input type="date" value={p.editDate ?? ''} onChange={(e) => patch({ editDate: e.target.value || undefined }, true)} />
        </Field>
        <Field label={$t("Estimated duration (minutes)")}>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={mins}
            onChange={(e) => {
              setMins(e.target.value);
              patch({ duration: e.target.value ? Math.round(parseFloat(e.target.value) * 60) : undefined });
            }}
          />
        </Field>
        <Field label={$t("Priority")}>
          <Segmented label={$t("Priority")} value={p.priority} onChange={(v) => patch({ priority: v as Priority }, true)} options={PRIORITIES.slice().reverse().map((x) => ({ value: x.id, label: x.label }))} />
        </Field>
        <Field label={$t("Tags")} className="span-2">
          <TagInput value={p.tags} onChange={(tags) => patch({ tags }, true)} />
        </Field>
      </div>
    </div>
  );
}

function ConceptTab({ p, patch }: TabProps) {
  const idea = useStore((s) => (p.ideaId ? s.ideas.find((i) => i.id === p.ideaId) : undefined));
  const set = (k: keyof ContentProject['concept'], v: string) => patch({ concept: { ...p.concept, [k]: v } });
  const fields: { k: keyof ContentProject['concept']; label: string; ph: string }[] = [
    { k: 'originalIdea', label: $t("Original idea"), ph: 'The spark — what made you want to make this?' },
    { k: 'objective', label: $t("Objective"), ph: 'What should this video achieve?' },
    { k: 'audience', label: $t("Audience"), ph: 'Who is it for? What do they already know?' },
    { k: 'message', label: $t("Main message"), ph: 'If they remember one thing, it’s…' },
    { k: 'references', label: $t("References"), ph: 'Videos, creators, links…' },
    { k: 'inspiration', label: $t("Inspiration"), ph: 'Mood, music, visual style…' },
  ];
  return (
    <div className="form">
      {idea && (
        <button className="source-idea" onClick={() => openModal({ kind: 'idea', id: idea.id })}>
          <Lightbulb size={15} /> {$t("Born from the idea")} <b>“{idea.title}”</b>
        </button>
      )}
      <div className="form-grid">
        {fields.map((f) => (
          <Field key={f.k} label={f.label} className={f.k === 'originalIdea' || f.k === 'message' ? 'span-2' : undefined}>
            <Textarea autoGrow value={p.concept[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} style={{ minHeight: 76 }} />
          </Field>
        ))}
      </div>
    </div>
  );
}

function ScriptTab({ p, patch }: TabProps) {
  const sections: { k: keyof ContentProject['script']; label: string; ph: string; hint?: string }[] = [
    { k: 'hook', label: $t("Hook"), ph: 'The first 2 seconds. Make them stop scrolling.', hint: '0–3 s' },
    { k: 'intro', label: $t("Introduction"), ph: 'Set up the promise of the video.' },
    { k: 'body', label: $t("Development"), ph: 'The meat — story, steps, arguments.' },
    { k: 'keyPoints', label: $t("Key points"), ph: 'Bullet the beats you can’t forget.' },
    { k: 'cta', label: $t("Call to action"), ph: 'Follow, save, comment, link in bio…' },
    { k: 'closing', label: $t("Closing"), ph: 'Land it. Loop it back to the hook?' },
  ];
  const full = sections.map((s) => p.script[s.k]).filter(Boolean).join('\n\n');
  const words = wordCount(full);
  const secs = Math.round((words / 150) * 60);
  return (
    <div className="script">
      <div className="script__bar">
        <span className="badge">{words} words</span>
        <span className="badge badge--accent">≈ {secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`} spoken</span>
        <span className="subtle hide-mobile" style={{ fontSize: 12 }}>{$t("Autosaves as you type")}</span>
        <Button
          size="sm"
          icon={<Copy />}
          style={{ marginLeft: 'auto' }}
          disabled={!full}
          onClick={async () => toast((await copyText(full)) ? $t("Script copied") : $t("Could not copy"), { tone: full ? 'success' : 'error' })}
        >
          {$t("Copy script")}
        </Button>
      </div>
      {sections.map((s, i) => (
        <section key={s.k} className="script__section">
          <div className="script__label">
            <span className="script__num mono">{String(i + 1).padStart(2, '0')}</span>
            {s.label}
            {s.hint && <span className="subtle" style={{ fontSize: 11.5, fontWeight: 500 }}>{s.hint}</span>}
            <span className="subtle tnum" style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 500 }}>{wordCount(p.script[s.k])} w</span>
          </div>
          <Textarea autoGrow className="script__text" value={p.script[s.k]} onChange={(e) => patch({ script: { ...p.script, [s.k]: e.target.value } })} placeholder={s.ph} aria-label={s.label} />
        </section>
      ))}
    </div>
  );
}

function ShotsTab({ p, patch }: TabProps) {
  const set = (shots: Shot[], immediate = false) => patch({ shots }, immediate);
  const upd = (id: string, x: Partial<Shot>, immediate = false) => set(p.shots.map((s) => (s.id === id ? { ...s, ...x } : s)), immediate);
  const add = () => set([...p.shots, { id: uid(), description: '', type: 'Medium', location: '', gear: '', status: 'pending', notes: '' }], true);
  const move = (i: number, d: -1 | 1) => {
    const next = [...p.shots];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    set(next, true);
  };
  const done = p.shots.filter((s) => s.status !== 'pending').length;
  return (
    <div className="col gap-12">
      <div className="row between">
        <div className="row gap-12 grow" style={{ maxWidth: 360 }}>
          <span className="grow">
            <ProgressBar value={p.shots.length ? (done / p.shots.length) * 100 : 0} label={$t("Shots recorded")} />
          </span>
          <span className="tnum subtle" style={{ fontSize: 12 }}>{done}/{p.shots.length} shot</span>
        </div>
        <Button size="sm" variant="primary" icon={<Plus />} onClick={add}>
          {$t("Add shot")}
        </Button>
      </div>
      {p.shots.length === 0 ? (
        <EmptyState compact icon={<Film />} title={$t("No shots planned")} text={$t("List every plane you need so recording day is calm and fast.")} actions={<Button icon={<Plus />} onClick={add}>{$t("Add first shot")}</Button>} />
      ) : (
        <div className="shots">
          {p.shots.map((s, i) => (
            <div key={s.id} className={cn('shot', s.status === 'shot' && 'shot--done', s.status === 'skipped' && 'shot--skipped')}>
              <div className="shot__num display">{i + 1}</div>
              <div className="shot__body">
                <Input sm value={s.description} onChange={(e) => upd(s.id, { description: e.target.value })} placeholder={$t("Describe the shot")} aria-label={$t("Shot description")} className="shot__desc" />
                <div className="shot__fields">
                  <Select sm value={s.type} onChange={(e) => upd(s.id, { type: e.target.value }, true)} options={Array.from(new Set([...SHOT_TYPES, s.type])).map((t) => ({ value: t, label: $t(t) }))} aria-label={$t("Shot type")} />
                  <Input sm value={s.location} onChange={(e) => upd(s.id, { location: e.target.value })} placeholder={$t("Location")} aria-label={$t("Location")} />
                  <Input sm value={s.gear} onChange={(e) => upd(s.id, { gear: e.target.value })} placeholder={$t("Gear needed")} aria-label={$t("Gear")} />
                </div>
                <Input sm value={s.notes} onChange={(e) => upd(s.id, { notes: e.target.value })} placeholder={$t("Notes")} aria-label={$t("Notes")} />
              </div>
              <div className="shot__side">
                <Segmented
                  label={$t("Status")}
                  value={s.status}
                  onChange={(v) => upd(s.id, { status: v }, true)}
                  options={[
                    { value: 'pending', label: $t("To shoot") },
                    { value: 'shot', label: $t("Shot") },
                    { value: 'skipped', label: $t("Skip") },
                  ]}
                />
                <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" iconOnly icon={<ArrowUp />} disabled={i === 0} onClick={() => move(i, -1)} aria-label={$t("Move up")} />
                  <Button variant="ghost" size="sm" iconOnly icon={<ArrowDown />} disabled={i === p.shots.length - 1} onClick={() => move(i, 1)} aria-label={$t("Move down")} />
                  <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => set(p.shots.filter((x) => x.id !== s.id), true)} aria-label={$t("Delete shot")} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistTab({ title, items, onChange, template }: { title: string; items: ChecklistItem[]; onChange: (i: ChecklistItem[]) => void; template: string[] }) {
  const [draft, setDraft] = useState('');
  const done = items.filter((i) => i.done).length;
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, { id: uid(), label: draft.trim(), done: false }]);
    setDraft('');
  };
  return (
    <div className="col gap-16">
      <div className="row gap-16">
        <ProgressRing value={items.length ? (done / items.length) * 100 : 0} size={56} stroke={5}>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>{items.length ? Math.round((done / items.length) * 100) : 0}%</span>
        </ProgressRing>
        <div className="grow">
          <div className="display" style={{ fontSize: 20 }}>{title}</div>
          <div className="subtle" style={{ fontSize: 13 }}>{done} of {items.length} done</div>
        </div>
        <Menu
          items={[
            { label: $t("Mark all done"), icon: <Check />, onSelect: () => onChange(items.map((i) => ({ ...i, done: true }))) },
            { label: $t("Uncheck all"), icon: <RotateCcw />, onSelect: () => onChange(items.map((i) => ({ ...i, done: false }))) },
            {
              label: $t("Reset to template"),
              icon: <ListChecks />,
              onSelect: async () => {
                if (await confirmDialog({ title: $t("Reset checklist?"), description: $t("Replaces this list with your default template (Settings → Checklists)."), confirmLabel: $t("Reset"), tone: 'default' }))
                  onChange(template.map((label) => ({ id: uid(), label, done: false })));
              },
            },
          ]}
          trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label={$t("Checklist actions")} />}
        />
      </div>
      <ul className="checklist">
        {items.map((i) => (
          <li key={i.id} className={cn('checklist__item', i.done && 'checklist__item--done')}>
            <Checkbox checked={i.done} onChange={(c) => onChange(items.map((x) => (x.id === i.id ? { ...x, done: c } : x)))} label={i.label} />
            <input className="checklist__input" value={i.label} onChange={(e) => onChange(items.map((x) => (x.id === i.id ? { ...x, label: e.target.value } : x)))} aria-label={$t("Checklist item")} />
            <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => onChange(items.filter((x) => x.id !== i.id))} aria-label={$t('Remove {name}', { name: i.label })} />
          </li>
        ))}
      </ul>
      <div className="row">
        <Input sm value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={$t("Add a step and press Enter")} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button size="sm" icon={<Plus />} onClick={add}>
          {$t("Add")}
        </Button>
      </div>
    </div>
  );
}

function AssetPicker({ label, value, onChange, projectId }: { label: string; value?: string; onChange: (id?: string) => void; projectId: string }) {
  const assets = useStore(useShallow((s) => s.assets.filter((a) => a.mime.startsWith('image/') && !a.system)));
  const asset = assets.find((a) => a.id === value);
  return (
    <Field label={label}>
      <div className="picker">
        <AssetThumb asset={asset} className="picker__thumb" />
        <div className="col grow" style={{ gap: 6 }}>
          <Select sm value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} options={assets.map((a) => ({ value: a.id, label: a.name }))} placeholder={$t("None")} aria-label={label} />
          <Dropzone
            compact
            accept="image/*"
            onFiles={async (files) => {
              const [a] = await uploadFiles(files.slice(0, 1), { type: label.toLowerCase().includes('cover') ? 'cover' : 'thumbnail', projectId });
              if (a) {
                onChange(a.id);
                toast($t('{label} uploaded', { label }));
              }
            }}
          >
            <span className="subtle" style={{ fontSize: 12 }}>{$t("Drop an image or click to upload")}</span>
          </Dropzone>
        </div>
      </div>
    </Field>
  );
}

const CAPTION_LIMITS: Record<string, number> = { tiktok: 2200, ig_reels: 2200, ig_stories: 2200, yt_shorts: 100, yt_long: 5000 };

function PublishTab({ p, patch, onPublish }: TabProps & { onPublish: () => void }) {
  const platforms = useStore((s) => s.settings.platforms);
  const stats = useStore(useShallow((s) => s.analytics.filter((a) => a.projectId === p.id)));
  const pub = p.publication;
  const set = (x: Partial<ContentProject['publication']>, immediate = false) => patch({ publication: { ...pub, ...x } }, immediate);
  const tags = pub.hashtags.split(/\s+/).filter((t) => t.startsWith('#') && t.length > 1);
  const limit = Math.min(...p.platformIds.map((id) => CAPTION_LIMITS[id] ?? 2200), 2200);
  return (
    <div className="form">
      <Field label={$t("Caption")} aside={<span className={cn('tnum', pub.caption.length > limit ? 'field__error' : 'subtle')} style={{ fontSize: 11.5 }}>{pub.caption.length}/{limit}</span>}>
        <Textarea autoGrow value={pub.caption} onChange={(e) => set({ caption: e.target.value })} placeholder={$t("Write the caption…")} style={{ minHeight: 110 }} />
      </Field>
      <Field label={$t("Hashtags")} aside={<span className="subtle tnum" style={{ fontSize: 11.5 }}>{tags.length} tags</span>} hint={$t("Separate with spaces, e.g. #creator #vlog")}>
        <Input value={pub.hashtags} onChange={(e) => set({ hashtags: e.target.value })} placeholder="#creator #behindthescenes" />
      </Field>
      <div className="form-grid">
        <AssetPicker label={$t("Cover")} value={pub.coverAssetId} onChange={(coverAssetId) => set({ coverAssetId }, true)} projectId={p.id} />
        <AssetPicker label={$t("Thumbnail")} value={pub.thumbnailAssetId} onChange={(thumbnailAssetId) => set({ thumbnailAssetId }, true)} projectId={p.id} />
        <Field label={$t("Platforms")} className="span-2">
          <ChipToggle options={platforms.map((x) => ({ value: x.id, label: x.name, color: x.color }))} value={p.platformIds} onChange={(platformIds) => patch({ platformIds }, true)} />
        </Field>
        <Field label={$t("Date")}>
          <Input type="date" value={p.publishDate ?? ''} onChange={(e) => patch({ publishDate: e.target.value || undefined }, true)} />
        </Field>
        <Field label={$t("Time")}>
          <Input type="time" value={p.publishTime ?? ''} onChange={(e) => patch({ publishTime: e.target.value || undefined }, true)} />
        </Field>
        <Field label={$t("Publication link")} className="span-2">
          <div className="row">
            <Input value={pub.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://www.tiktok.com/@you/video/…" />
            {/^https?:\/\//.test(pub.link) && (
              <a className="btn btn--icon" href={pub.link} target="_blank" rel="noreferrer" aria-label={$t("Open link")}>
                <Link2 />
              </a>
            )}
          </div>
        </Field>
      </div>
      <div className="publish-bar">
        {p.stage === 'published' ? (
          <>
            <span className="badge badge--solid-lime">
              <Check /> {$t("Published")} {p.publishedAt ? fmtDate(p.publishedAt, 'd MMM, HH:mm') : ''}
            </span>
            <span className="subtle grow" style={{ fontSize: 12.5 }}>{stats.length ? `${stats.length} stats record(s) · ${compact(sumRecords(stats).views)} views` : $t("No statistics logged yet.")}</span>
            <Button icon={<BarChart3 />} onClick={() => openModal({ kind: 'stats', defaults: { projectId: p.id } })}>
              {$t("Log statistics")}
            </Button>
          </>
        ) : (
          <>
            <span className="subtle grow" style={{ fontSize: 12.5 }}>{$t("When it’s live, mark it as published — it will count toward your monthly stats and goals.")}</span>
            <Button variant="lime" icon={<Send />} onClick={onPublish}>
              {$t("Mark as published")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function FilesTab({ p }: { p: ContentProject }) {
  const assets = useStore((s) => s.assets);
  const linked = assets.filter((a) => p.assetIds.includes(a.id) || a.projectIds.includes(p.id));
  const others = assets.filter((a) => !linked.includes(a));
  const store = useStore.getState();
  return (
    <div className="col gap-16">
      <Dropzone
        onFiles={async (files) => {
          const c = await uploadFiles(files, { projectId: p.id });
          if (c.length) toast(c.length > 1 ? $t('{n} files attached', { n: c.length }) : $t('1 file attached'));
        }}
      />
      {others.length > 0 && (
        <div className="row">
          <Select
            sm
            value=""
            onChange={(e) => {
              if (e.target.value) {
                store.linkAsset(e.target.value, p.id, true);
                toast($t("File linked"));
              }
            }}
            options={others.map((a) => ({ value: a.id, label: `${a.name} · ${a.type}` }))}
            placeholder={$t("Link a file from the Asset Library…")}
            aria-label={$t("Link existing asset")}
          />
        </div>
      )}
      {linked.length === 0 ? (
        <EmptyState compact icon={<ImageIcon />} title={$t("No files yet")} text={$t("References, thumbnails, raw clips, music — attach anything this video needs.")} />
      ) : (
        <div className="file-grid">
          {linked.map((a) => (
            <div key={a.id} className="file-card">
              <button className="file-card__preview" onClick={() => openModal({ kind: 'asset', id: a.id })} aria-label={`Open ${a.name}`}>
                <AssetThumb asset={a} />
              </button>
              <div className="row" style={{ gap: 4, padding: '8px 4px 2px 8px' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>{a.name}</div>
                  <div className="subtle" style={{ fontSize: 11 }}>{a.type}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={<Unlink />}
                  tip={$t("Unlink")}
                  onClick={() => {
                    store.linkAsset(a.id, p.id, false);
                    toast($t("File unlinked"), { description: $t("It stays in your Asset Library.") });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Aside({ p, prog }: { p: ContentProject; prog: number }) {
  const tasks = useStore(useShallow((s) => s.tasks.filter((t) => t.projectId === p.id)));
  const minutes = useStore((s) => s.timeLogs.filter((t) => t.projectId === p.id).reduce((a, t) => a + t.minutes, 0));
  const stats = useStore(useShallow((s) => s.analytics.filter((a) => a.projectId === p.id)));
  const [draft, setDraft] = useState('');
  const store = useStore.getState();
  const sum = useMemo(() => sumRecords(stats), [stats]);
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const add = () => {
    if (!draft.trim()) return;
    store.insert('tasks', newTask({ title: draft.trim(), projectId: p.id, category: 'content' }));
    setDraft('');
  };
  return (
    <aside className="ws__aside">
      <div className="panel ws-card">
        <div className="row gap-16">
          <ProgressRing value={prog} size={72} stroke={7}>
            <span className="display" style={{ fontSize: 20 }}>{prog}%</span>
          </ProgressRing>
          <div className="col" style={{ gap: 2 }}>
            <span className="eyebrow">{$t("Stage")}</span>
            <span className="display" style={{ fontSize: 22 }}>{STAGES.find((s) => s.id === p.stage)?.label}</span>
            <span className="subtle" style={{ fontSize: 12 }}>{$t("Updated")} {fmtDate(p.updatedAt, 'd MMM, HH:mm')}</span>
          </div>
        </div>
        <dl className="ws-dl">
          <dt>{$t("Record")}</dt>
          <dd>{p.recordDate ? relativeDay(p.recordDate) : '—'}</dd>
          <dt>{$t("Edit")}</dt>
          <dd>{p.editDate ? relativeDay(p.editDate) : '—'}</dd>
          <dt>{$t("Publish")}</dt>
          <dd>{p.publishDate ? `${relativeDay(p.publishDate)}${p.publishTime ? ` · ${p.publishTime}` : ''}` : '—'}</dd>
          <dt>{$t("Time spent")}</dt>
          <dd>
            {fmtMinutes(minutes)}{' '}
            <button className="link-btn" onClick={() => openModal({ kind: 'timelog', defaults: { projectId: p.id } })}>
              {$t("+ log")}
            </button>
          </dd>
        </dl>
      </div>
      <div className="panel ws-card">
        <div className="row between">
          <span className="eyebrow">{$t("Tasks ·")} {done.length}/{tasks.length}</span>
          <Button variant="ghost" size="sm" iconOnly icon={<Plus />} tip={$t("New task")} onClick={() => openModal({ kind: 'task', defaults: { projectId: p.id, category: 'content' } })} />
        </div>
        <ul className="mini-tasks">
          {[...open, ...done].slice(0, 8).map((t) => (
            <li key={t.id} className={cn(t.status === 'done' && 'done')}>
              <Checkbox sm round checked={t.status === 'done'} onChange={() => store.toggleTask(t.id)} label={t.title} />
              <button className="truncate grow" style={{ textAlign: 'left' }} onClick={() => openModal({ kind: 'task', id: t.id })}>
                {t.title}
              </button>
              {t.dueDate && <span className={cn('subtle tnum', t.dueDate < todayStr() && t.status !== 'done' && 'danger-text')} style={{ fontSize: 11 }}>{relativeDay(t.dueDate)}</span>}
            </li>
          ))}
        </ul>
        <input className="input input--sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={$t("Quick task for this video…")} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label={$t("Quick task")} />
      </div>
      <div className="panel ws-card">
        <div className="row between">
          <span className="eyebrow">{$t("Performance")}</span>
          <Button variant="ghost" size="sm" iconOnly icon={<Plus />} tip={$t("Log statistics")} onClick={() => openModal({ kind: 'stats', defaults: { projectId: p.id } })} />
        </div>
        {stats.length === 0 ? (
          <p className="subtle" style={{ fontSize: 12.5 }}>{$t("No statistics yet. Log them after publishing.")}</p>
        ) : (
          <div className="perf">
            <div><span className="display">{compact(sum.views)}</span><span>views</span></div>
            <div><span className="display">{sum.engagement.toFixed(1)}%</span><span>engagement</span></div>
            <div><span className="display">{compact(sum.likes)}</span><span>likes</span></div>
            <div><span className="display">+{compact(sum.followersGained)}</span><span>followers</span></div>
          </div>
        )}
      </div>
    </aside>
  );
}
