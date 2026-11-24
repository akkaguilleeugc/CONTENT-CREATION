import { ArrowDown, ArrowUp, CalendarDays, Clapperboard, Columns3, Copy, List, MoreHorizontal, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProgressBar } from '@/components/charts';
import { KanbanBoard } from '@/components/Kanban';
import { EmptyState, Menu } from '@/components/overlay';
import { Button, PageHeader, PlatformDots, PriorityTag, SearchInput, Segmented, Select } from '@/components/ui';
import { AssetThumb } from '@/features/assets';
import { FORMATS, PRIORITIES, STAGES, priorityRank, stageIndex } from '@/lib/constants';
import { usePlatforms } from '@/lib/hooks';
import { projectProgress } from '@/lib/metrics';
import { useStore } from '@/lib/store';
import type { ContentProject, Stage } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, daysFromToday, relativeDay } from '@/lib/utils';

import { $t } from '@/lib/i18n';
type View = 'board' | 'list';
type SortKey = 'title' | 'stage' | 'date' | 'priority' | 'progress';

const STAGE_ACCENT = (i: number) => `color-mix(in srgb, var(--royal) ${100 - i * 11}%, var(--lime))`;

function Thumb({ p }: { p: ContentProject }) {
  const asset = useStore((s) => {
    const id = p.publication.thumbnailAssetId ?? p.publication.coverAssetId;
    return id ? s.assets.find((a) => a.id === id) : undefined;
  });
  if (!asset) return null;
  return <AssetThumb asset={asset} className="pcard__thumb" />;
}

export function ProjectCard({ p }: { p: ContentProject }) {
  const prog = projectProgress(p);
  const late = p.publishDate && p.stage !== 'published' && (daysFromToday(p.publishDate) ?? 0) < 0;
  return (
    <div className="pcard">
      <Thumb p={p} />
      <div className="pcard__title">{p.title || $t("Untitled video")}</div>
      <div className="row wrap" style={{ gap: 6 }}>
        <PlatformDots ids={p.platformIds} />
        <span className="subtle" style={{ fontSize: 11.5 }}>{FORMATS.find((f) => f.id === p.format)?.label}</span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className="grow">
          <ProgressBar value={prog} label={$t("Progress")} />
        </span>
        <span className="tnum subtle" style={{ fontSize: 11 }}>{prog}%</span>
      </div>
      <div className="row between">
        <PriorityTag p={p.priority} label={false} />
        {p.publishDate ? (
          <span className={cn('badge', late ? 'badge--danger' : p.stage === 'published' ? 'badge--positive' : 'badge--outline')}>
            <CalendarDays />
            {relativeDay(p.publishDate)}
            {p.publishTime ? ` · ${p.publishTime}` : ''}
          </span>
        ) : (
          <span className="subtle" style={{ fontSize: 11.5 }}>{$t("No date")}</span>
        )}
      </div>
    </div>
  );
}

export default function Studio() {
  const projects = useStore((s) => s.projects);
  const platforms = usePlatforms();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => (params.get('stage') ? 'list' : 'board'));
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('');
  const [priority, setPriority] = useState('');
  const stageFilter = params.get('stage') ?? '';
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: 1 });
  const store = useStore.getState();

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        const query = q.trim().toLowerCase();
        return (
          (!query || `${p.title} ${p.description} ${p.tags.join(' ')} ${p.category}`.toLowerCase().includes(query)) &&
          (!platform || p.platformIds.includes(platform)) &&
          (!priority || p.priority === priority) &&
          (view === 'board' || !stageFilter || p.stage === stageFilter)
        );
      }),
    [projects, q, platform, priority, stageFilter, view],
  );

  const sorted = useMemo(() => {
    const val = (p: ContentProject): string | number => {
      switch (sort.key) {
        case 'title':
          return p.title.toLowerCase();
        case 'stage':
          return stageIndex(p.stage);
        case 'priority':
          return priorityRank(p.priority);
        case 'progress':
          return projectProgress(p);
        default:
          return `${p.publishDate ?? '9999'}${p.publishTime ?? ''}`;
      }
    };
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [filtered, sort]);

  const inProd = projects.filter((p) => ['recording', 'editing', 'review'].includes(p.stage)).length;
  const scheduled = projects.filter((p) => p.stage === 'scheduled').length;

  const moveTo = (p: ContentProject, stage: Stage) => {
    store.setStage(p.id, stage);
    toast($t('Moved to {where}', { where: STAGES.find((s) => s.id === stage)?.label ?? '' }), { description: p.title, action: { label: $t("Undo"), run: () => useStore.getState().setStage(p.id, p.stage) } });
  };

  const th = (key: SortKey, label: string, cls?: string) => (
    <th className={cls}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} aria-label={$t('Sort by {label}', { label })}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  return (
    <div className={cn('page', view === 'board' && 'page--wide')}>
      <PageHeader
        title={$t("Content Studio")}
        sub={projects.length ? $t('{n} videos · {p} in production · {s} scheduled', { n: projects.length, p: inProd, s: scheduled }) : $t("Every video is a project: concept, script, shots, edit and publishing in one place.")}
        actions={
          <>
            <Segmented
              label={$t("View")}
              value={view}
              onChange={setView}
              options={[
                { value: 'board', icon: <Columns3 />, label: $t("Board") },
                { value: 'list', icon: <List />, label: $t("List") },
              ]}
            />
            <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'project' })} kbd="V">
              {$t("New video")}
            </Button>
          </>
        }
      />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder={$t("Search videos…")} />
        <Select sm value={platform} onChange={(e) => setPlatform(e.target.value)} options={platforms.list.map((p) => ({ value: p.id, label: p.name }))} placeholder={$t("All platforms")} aria-label={$t("Platform")} style={{ width: 'auto' }} />
        <Select sm value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))} placeholder={$t("Any priority")} aria-label={$t("Priority")} style={{ width: 'auto' }} />
        {view === 'list' && (
          <Select
            sm
            value={stageFilter}
            onChange={(e) => {
              const v = e.target.value;
              setParams(v ? { stage: v } : {});
            }}
            options={STAGES.map((s) => ({ value: s.id, label: s.label }))}
            placeholder={$t("All stages")}
            aria-label={$t("Stage")}
            style={{ width: 'auto' }}
          />
        )}
      </div>

      {projects.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Clapperboard />}
            title={$t("No videos in production yet")}
            text={$t("Create a video project from scratch or convert one of your ideas.")}
            actions={
              <>
                <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'project' })}>
                  {$t("New video")}
                </Button>
                <Button onClick={() => navigate('/ideas')}>{$t("Browse ideas")}</Button>
              </>
            }
          />
        </div>
      ) : view === 'board' ? (
        <KanbanBoard
          columns={STAGES.map((s, i) => ({
            id: s.id,
            title: s.label,
            accent: STAGE_ACCENT(i),
            footer:
              s.id === 'idea' || s.id === 'planning' ? (
                <button className="kcol__add" onClick={() => openModal({ kind: 'project', defaults: { stage: s.id } })}>
                  <Plus size={14} /> {$t("Add video")}
                </button>
              ) : undefined,
          }))}
          items={filtered}
          columnOf={(p) => p.stage}
          onMove={(p, to) => moveTo(p, to as Stage)}
          onOpen={(p) => navigate(`/studio/${p.id}`)}
          renderCard={(p) => <ProjectCard p={p} />}
          emptyLabel="Drag a video here"
        />
      ) : sorted.length === 0 ? (
        <div className="panel">
          <EmptyState icon={<Clapperboard />} title={$t("No videos match")} text={$t("Try another filter.")} actions={<Button onClick={() => (setQ(''), setPlatform(''), setPriority(''), setParams({}))}>{$t("Clear filters")}</Button>} />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {th('title', 'Video')}
                <th className="hide-mobile">{$t("Platforms")}</th>
                {th('stage', 'Stage')}
                {th('date', 'Publish', 'hide-mobile')}
                {th('progress', 'Progress', 'hide-mobile')}
                {th('priority', 'Priority', 'hide-mobile')}
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const prog = projectProgress(p);
                return (
                  <tr key={p.id} className="clickable" onClick={() => navigate(`/studio/${p.id}`)}>
                    <td style={{ fontWeight: 600, maxWidth: 360 }}>
                      <div className="truncate">{p.title || $t("Untitled video")}</div>
                      <div className="subtle" style={{ fontSize: 12, fontWeight: 400 }}>{p.category}</div>
                    </td>
                    <td className="hide-mobile">
                      <PlatformDots ids={p.platformIds} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Select sm value={p.stage} onChange={(e) => moveTo(p, e.target.value as Stage)} options={STAGES.map((s) => ({ value: s.id, label: s.label }))} aria-label={$t("Stage")} style={{ width: 150 }} />
                    </td>
                    <td className="hide-mobile tnum">{p.publishDate ? `${relativeDay(p.publishDate)}${p.publishTime ? ` · ${p.publishTime}` : ''}` : <span className="subtle">—</span>}</td>
                    <td className="hide-mobile" style={{ minWidth: 140 }}>
                      <div className="row">
                        <span className="grow">
                          <ProgressBar value={prog} label={$t("Progress")} />
                        </span>
                        <span className="tnum subtle" style={{ fontSize: 12, width: 34, textAlign: 'right' }}>{prog}%</span>
                      </div>
                    </td>
                    <td className="hide-mobile">
                      <PriorityTag p={p.priority} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Menu
                        items={[
                          { label: $t("Open workspace"), icon: <ExternalLink />, onSelect: () => navigate(`/studio/${p.id}`) },
                          {
                            label: $t("Duplicate"),
                            icon: <Copy />,
                            onSelect: () => {
                              store.duplicateProject(p.id);
                              toast($t("Video duplicated"));
                            },
                          },
                          {
                            label: $t("Delete"),
                            icon: <Trash2 />,
                            danger: true,
                            separator: true,
                            onSelect: async () => {
                              if (await confirmDialog({ title: $t('Delete “{name}”?', { name: p.title }), description: $t("Linked tasks, events and files stay — they are just unlinked.") })) {
                                store.deleteProject(p.id);
                                toast($t("Video deleted"));
                              }
                            },
                          },
                        ]}
                        trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label={$t("Actions")} />}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
