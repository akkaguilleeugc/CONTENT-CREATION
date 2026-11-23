import {
  Archive,
  ArchiveRestore,
  ArrowRightCircle,
  Columns3,
  Copy,
  LayoutGrid,
  Lightbulb,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanBoard } from '@/components/Kanban';
import { EmptyState, Menu, type MenuEntry } from '@/components/overlay';
import { Button, PageHeader, PlatformDots, PriorityTag, SearchInput, Segmented, Select } from '@/components/ui';
import { FORMATS, IDEA_STATUSES, priorityRank } from '@/lib/constants';
import { usePlatforms } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import type { Idea, IdeaStatus } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, fmtDate, matches } from '@/lib/utils';

type View = 'grid' | 'list' | 'kanban';
type Sort = 'newest' | 'oldest' | 'priority' | 'title' | 'updated';

const STATUS_ACCENT: Record<IdeaStatus, string> = {
  inbox: 'var(--text-3)',
  interesting: '#8EA6FF',
  developing: 'var(--royal)',
  ready: 'var(--lime)',
  converted: 'var(--neon-lime)',
  archived: 'var(--text-4)',
};

const readView = (): View => {
  try {
    return (localStorage.getItem('creator-os:ideas-view') as View) || 'grid';
  } catch {
    return 'grid';
  }
};

export default function Ideas() {
  const ideas = useStore((s) => s.ideas);
  const categories = useStore((s) => s.settings.ideaCategories);
  const platforms = usePlatforms();
  const navigate = useNavigate();
  const [view, setViewState] = useState<View>(readView);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('newest');
  const [showArchived, setShowArchived] = useState(false);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem('creator-os:ideas-view', v);
    } catch {
      /* ignore */
    }
  };

  const filtered = useMemo(() => {
    let list = ideas.filter(
      (i) =>
        matches(q, i.title, i.description, i.tags, i.reference) &&
        (!category || i.category === category) &&
        (!platform || i.platformIds.includes(platform)) &&
        (!favOnly || i.favorite) &&
        (view === 'kanban' || (!status ? showArchived || i.status !== 'archived' : i.status === status)),
    );
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.createdAt.localeCompare(b.createdAt);
        case 'priority':
          return priorityRank(b.priority) - priorityRank(a.priority) || b.createdAt.localeCompare(a.createdAt);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'updated':
          return b.updatedAt.localeCompare(a.updatedAt);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return list;
  }, [ideas, q, category, platform, favOnly, status, showArchived, sort, view]);

  const ready = ideas.filter((i) => i.status === 'ready').length;
  const filtering = !!(q || category || platform || status || favOnly);
  const store = useStore.getState();

  const menuFor = (i: Idea): MenuEntry[] => [
    { label: 'Edit', icon: <Pencil />, onSelect: () => openModal({ kind: 'idea', id: i.id }) },
    { label: i.favorite ? 'Remove favourite' : 'Mark favourite', icon: <Star />, onSelect: () => store.update('ideas', i.id, { favorite: !i.favorite }) },
    {
      label: i.projectId ? 'Open video project' : 'Convert to content',
      icon: <ArrowRightCircle />,
      onSelect: () => {
        const p = i.projectId ? store.projects.find((x) => x.id === i.projectId) ?? store.convertIdea(i.id) : store.convertIdea(i.id);
        if (p) {
          if (!i.projectId) toast('Converted to a video project', { description: i.title });
          navigate(`/studio/${p.id}`);
        }
      },
    },
    {
      label: 'Duplicate',
      icon: <Copy />,
      onSelect: () => {
        store.duplicateIdea(i.id);
        toast('Idea duplicated');
      },
    },
    {
      label: i.status === 'archived' ? 'Restore to inbox' : 'Archive',
      icon: i.status === 'archived' ? <ArchiveRestore /> : <Archive />,
      onSelect: () => store.update('ideas', i.id, { status: i.status === 'archived' ? 'inbox' : 'archived' }),
    },
    {
      label: 'Delete',
      icon: <Trash2 />,
      danger: true,
      separator: true,
      onSelect: async () => {
        if (await confirmDialog({ title: `Delete “${i.title}”?` })) {
          store.remove('ideas', i.id);
          toast('Idea deleted', {
            action: { label: 'Undo', run: () => useStore.getState().insert('ideas', i) },
          });
        }
      },
    },
  ];

  const actions = (i: Idea) => (
    <Menu
      items={menuFor(i)}
      trigger={(p) => (
        <Button {...p} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label={`Actions for ${i.title}`} onPointerDown={(e) => e.stopPropagation()} />
      )}
    />
  );

  const favBtn = (i: Idea) => (
    <button
      className={cn('fav', i.favorite && 'fav--on')}
      onClick={(e) => {
        e.stopPropagation();
        store.update('ideas', i.id, { favorite: !i.favorite });
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={i.favorite ? 'Remove favourite' : 'Mark favourite'}
      aria-pressed={i.favorite}
    >
      <Star />
    </button>
  );

  const card = (i: Idea, compact = false) => (
    <>
      <div className="idea__top">
        <span className="eyebrow">{i.category}</span>
        <span className="row" style={{ gap: 2 }}>
          {favBtn(i)}
          {!compact && actions(i)}
        </span>
      </div>
      <h3 className="idea__title">{i.title}</h3>
      {i.description && !compact && <p className="idea__desc line-clamp-3">{i.description}</p>}
      <div className="idea__foot">
        <PriorityTag p={i.priority} label={!compact} />
        <PlatformDots ids={i.platformIds} />
        {i.tags.slice(0, compact ? 1 : 2).map((t) => (
          <span key={t} className="tag">#{t}</span>
        ))}
        {!compact && (
          <span className="badge" style={{ marginLeft: 'auto' }}>
            <span className="dot" style={{ background: STATUS_ACCENT[i.status], width: 6, height: 6, boxShadow: 'none' }} />
            {IDEA_STATUSES.find((s) => s.id === i.status)?.label}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className={cn('page', view === 'kanban' && 'page--wide')}>
      <PageHeader
        title="My Ideas"
        sub={
          ideas.length ? (
            <>
              {ideas.length} ideas in your second brain · {ready} ready to produce.
            </>
          ) : (
            'Your second brain for content. Capture everything — sort it later.'
          )
        }
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', icon: <LayoutGrid />, tip: 'Grid' },
                { value: 'list', icon: <List />, tip: 'List' },
                { value: 'kanban', icon: <Columns3 />, tip: 'Kanban' },
              ]}
            />
            <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'idea' })} kbd="I">
              New idea
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search ideas, tags, references…" />
        <Select sm value={category} onChange={(e) => setCategory(e.target.value)} options={categories.map((c) => ({ value: c, label: c }))} placeholder="All categories" aria-label="Category" style={{ width: 'auto' }} />
        <Select sm value={platform} onChange={(e) => setPlatform(e.target.value)} options={platforms.list.map((p) => ({ value: p.id, label: p.name }))} placeholder="All platforms" aria-label="Platform" style={{ width: 'auto' }} />
        {view !== 'kanban' && (
          <Select sm value={status} onChange={(e) => setStatus(e.target.value)} options={IDEA_STATUSES.map((s) => ({ value: s.id, label: s.label }))} placeholder="Active statuses" aria-label="Status" style={{ width: 'auto' }} />
        )}
        <Select
          sm
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'priority', label: 'Priority' },
            { value: 'updated', label: 'Recently edited' },
            { value: 'title', label: 'Title A–Z' },
          ]}
          aria-label="Sort"
          style={{ width: 'auto' }}
        />
        <button className={cn('chip', favOnly && 'chip--on')} onClick={() => setFavOnly(!favOnly)} aria-pressed={favOnly}>
          <Star /> Favourites
        </button>
        {view !== 'kanban' && !status && (
          <button className={cn('chip', showArchived && 'chip--on')} onClick={() => setShowArchived(!showArchived)} aria-pressed={showArchived}>
            <Archive /> Archived
          </button>
        )}
      </div>

      {ideas.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Lightbulb />}
            title="Your idea bank is empty"
            text="Every great video starts as a messy thought. Capture one now — press I from anywhere."
            actions={
              <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'idea' })}>
                Capture first idea
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 && view !== 'kanban' ? (
        <div className="panel">
          <EmptyState
            icon={<Lightbulb />}
            title="No ideas match"
            text={filtering ? 'Try a different search or clear the filters.' : 'All your ideas are archived.'}
            actions={
              <Button
                onClick={() => {
                  setQ('');
                  setCategory('');
                  setPlatform('');
                  setStatus('');
                  setFavOnly(false);
                  setShowArchived(true);
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : view === 'grid' ? (
        <div className="idea-grid stagger">
          {filtered.map((i) => (
            <article key={i.id} className={cn('idea', i.status === 'archived' && 'idea--archived')} onClick={() => openModal({ kind: 'idea', id: i.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openModal({ kind: 'idea', id: i.id })}>
              {card(i)}
            </article>
          ))}
          <button className="idea idea--new" onClick={() => openModal({ kind: 'idea' })}>
            <Plus />
            New idea
          </button>
        </div>
      ) : view === 'list' ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Idea</th>
                <th className="hide-mobile">Category</th>
                <th className="hide-mobile">Platforms</th>
                <th className="hide-mobile">Format</th>
                <th>Priority</th>
                <th className="hide-mobile">Status</th>
                <th className="hide-mobile">Created</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => openModal({ kind: 'idea', id: i.id })}>
                  <td>{favBtn(i)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{i.title}</div>
                    {i.tags.length > 0 && <div className="subtle" style={{ fontSize: 12 }}>{i.tags.map((t) => `#${t}`).join(' ')}</div>}
                  </td>
                  <td className="hide-mobile">{i.category}</td>
                  <td className="hide-mobile">
                    <PlatformDots ids={i.platformIds} />
                  </td>
                  <td className="hide-mobile subtle">{FORMATS.find((f) => f.id === i.format)?.label ?? '—'}</td>
                  <td>
                    <PriorityTag p={i.priority} />
                  </td>
                  <td className="hide-mobile">
                    <span className="badge">
                      <span className="dot" style={{ background: STATUS_ACCENT[i.status], width: 6, height: 6, boxShadow: 'none' }} />
                      {IDEA_STATUSES.find((s) => s.id === i.status)?.label}
                    </span>
                  </td>
                  <td className="hide-mobile subtle tnum">{fmtDate(i.createdAt, 'd MMM')}</td>
                  <td onClick={(e) => e.stopPropagation()}>{actions(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <KanbanBoard
          columns={IDEA_STATUSES.map((s) => ({ id: s.id, title: s.label, hint: s.hint, accent: STATUS_ACCENT[s.id] }))}
          items={filtered}
          columnOf={(i) => i.status}
          onOpen={(i) => openModal({ kind: 'idea', id: i.id })}
          onMove={(i, to) => {
            if (to === 'converted' && !i.projectId) {
              const p = store.convertIdea(i.id);
              if (p) toast('Converted to a video project', { description: 'Find it in Content Studio.', action: { label: 'Open', run: () => navigate(`/studio/${p.id}`) } });
              return;
            }
            store.update('ideas', i.id, { status: to as IdeaStatus });
            toast(`Moved to ${IDEA_STATUSES.find((s) => s.id === to)?.label}`, { description: i.title });
          }}
          renderCard={(i) => card(i, true)}
        />
      )}
    </div>
  );
}
