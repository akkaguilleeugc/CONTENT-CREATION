import { Download, Folder, FolderOpen, FolderPlus, Inbox, LayoutGrid, Link2, List, MoreHorizontal, Pencil, Trash2, Upload, Check, X } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { EmptyState, Menu } from '@/components/overlay';
import { Button, PageHeader, SearchInput, Segmented, Select } from '@/components/ui';
import { AssetThumb, downloadAsset, uploadFiles } from '@/features/assets';
import { ASSET_TYPES, HABIT_COLORS } from '@/lib/constants';
import { useStore } from '@/lib/store';
import type { Asset } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, fmtBytes, fmtDate, matches, uid } from '@/lib/utils';

type View = 'grid' | 'list';
type Sort = 'newest' | 'name' | 'size' | 'type';

export default function Assets() {
  const assets = useStore((s) => s.assets);
  const folders = useStore((s) => s.folders);
  const [folder, setFolder] = useState<string>('all');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<View>('grid');
  const [dragging, setDragging] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const store = useStore.getState();

  const tags = useMemo(() => Array.from(new Set(assets.flatMap((a) => a.tags))).sort(), [assets]);
  const list = useMemo(() => {
    const out = assets.filter(
      (a) =>
        (folder === 'all' || (folder === 'none' ? !a.folderId : folder === 'brand' ? a.brand : folder === 'linked' ? a.projectIds.length > 0 : a.folderId === folder)) &&
        (!type || a.type === type) &&
        (!tag || a.tags.includes(tag)) &&
        matches(q, a.name, a.tags, a.note),
    );
    return out.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.size - a.size;
      if (sort === 'type') return a.type.localeCompare(b.type);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [assets, folder, type, tag, q, sort]);

  const totalSize = assets.filter((a) => !a.system).reduce((s, a) => s + a.size, 0);
  const defaults = folder !== 'all' && folder !== 'none' && folder !== 'brand' && folder !== 'linked' ? { folderId: folder } : folder === 'brand' ? { brand: true } : {};

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const c = await uploadFiles(files, defaults);
    if (c.length) toast(`${c.length} file${c.length > 1 ? 's' : ''} uploaded`);
  };

  const createFolder = () => {
    const name = newFolder?.trim();
    if (!name) return setNewFolder(null);
    const f = { id: uid(), name, color: HABIT_COLORS[folders.length % HABIT_COLORS.length]!, createdAt: new Date().toISOString() };
    store.insert('folders', f);
    setNewFolder(null);
    setFolder(f.id);
    toast('Folder created', { description: name });
  };

  const assetMenu = (a: Asset) => (
    <Menu
      items={[
        { label: 'Open', icon: <FolderOpen />, onSelect: () => openModal({ kind: 'asset', id: a.id }) },
        { label: 'Download', icon: <Download />, onSelect: () => downloadAsset(a) },
        { label: 'Rename & organise', icon: <Pencil />, onSelect: () => openModal({ kind: 'asset', id: a.id }), hidden: a.system },
        {
          label: 'Delete',
          icon: <Trash2 />,
          danger: true,
          separator: true,
          hidden: a.system,
          onSelect: async () => {
            if (await confirmDialog({ title: `Delete “${a.name}”?`, description: a.projectIds.length ? `Linked to ${a.projectIds.length} video(s); links are removed.` : 'The file is removed from this device.' })) {
              await store.deleteAsset(a.id);
              toast('Asset deleted');
            }
          },
        },
      ]}
      trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label={`Actions for ${a.name}`} />}
    />
  );

  const count = (pred: (a: Asset) => boolean) => assets.filter(pred).length;
  const sideItem = (id: string, label: string, icon: React.ReactNode, n: number, color?: string) => (
    <button className={cn('folder', folder === id && 'folder--on')} onClick={() => setFolder(id)}>
      {color ? <span className="folder__dot" style={{ background: color }} /> : icon}
      <span className="truncate grow">{label}</span>
      <span className="folder__n tnum">{n}</span>
    </button>
  );

  return (
    <div className="page" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)} onDrop={onDrop}>
      <PageHeader
        title="Asset Library"
        sub={`${assets.length} files · ${fmtBytes(totalSize)} stored privately on this device`}
        actions={
          <>
            <Segmented label="View" value={view} onChange={setView} options={[{ value: 'grid', icon: <LayoutGrid />, tip: 'Grid' }, { value: 'list', icon: <List />, tip: 'List' }]} />
            <Button variant="primary" icon={<Upload />} onClick={() => openModal({ kind: 'upload', defaults })} kbd="U">
              Upload
            </Button>
          </>
        }
      />
      <div className="lib">
        <aside className="lib__side">
          {sideItem('all', 'All files', <Inbox />, assets.length)}
          {sideItem('none', 'Unfiled', <Inbox />, count((a) => !a.folderId))}
          {sideItem('brand', 'Brand Kit', <Folder />, count((a) => a.brand))}
          {sideItem('linked', 'Linked to videos', <Link2 />, count((a) => a.projectIds.length > 0))}
          <div className="lib__label">
            Folders
            <Button variant="ghost" size="sm" iconOnly icon={<FolderPlus />} tip="New folder" onClick={() => setNewFolder('')} />
          </div>
          {newFolder !== null && (
            <form className="row" style={{ gap: 4, padding: '0 4px 6px' }} onSubmit={(e) => (e.preventDefault(), createFolder())}>
              <input className="input input--sm" autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" onBlur={createFolder} onKeyDown={(e) => e.key === 'Escape' && setNewFolder(null)} aria-label="Folder name" />
            </form>
          )}
          {folders.map((f) =>
            renaming?.id === f.id ? (
              <form
                key={f.id}
                className="row"
                style={{ gap: 4, padding: '0 4px 6px' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renaming.name.trim()) store.update('folders', f.id, { name: renaming.name.trim() });
                  setRenaming(null);
                }}
              >
                <input className="input input--sm" autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: f.id, name: e.target.value })} aria-label="Rename folder" />
                <Button type="submit" size="sm" iconOnly icon={<Check />} aria-label="Save" />
                <Button size="sm" variant="ghost" iconOnly icon={<X />} onClick={() => setRenaming(null)} aria-label="Cancel" />
              </form>
            ) : (
              <div key={f.id} className="folder-row">
                {sideItem(f.id, f.name, <Folder />, count((a) => a.folderId === f.id), f.color)}
                <Menu
                  items={[
                    { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming({ id: f.id, name: f.name }) },
                    {
                      label: 'Delete folder',
                      icon: <Trash2 />,
                      danger: true,
                      onSelect: async () => {
                        if (await confirmDialog({ title: `Delete folder “${f.name}”?`, description: 'Files inside are kept and moved to Unfiled.' })) {
                          store.deleteFolder(f.id);
                          if (folder === f.id) setFolder('all');
                          toast('Folder deleted');
                        }
                      },
                    },
                  ]}
                  trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label={`Folder ${f.name} actions`} className="folder-row__menu" />}
                />
              </div>
            ),
          )}
          {!folders.length && newFolder === null && <p className="subtle" style={{ fontSize: 12, padding: '2px 10px' }}>No folders yet.</p>}
        </aside>

        <div className="lib__main">
          <div className="toolbar">
            <SearchInput value={q} onChange={setQ} placeholder="Search files and tags…" />
            <Select sm value={type} onChange={(e) => setType(e.target.value)} options={ASSET_TYPES.map((t) => ({ value: t.id, label: t.label }))} placeholder="All types" aria-label="Type" style={{ width: 'auto' }} />
            {tags.length > 0 && <Select sm value={tag} onChange={(e) => setTag(e.target.value)} options={tags.map((t) => ({ value: t, label: `#${t}` }))} placeholder="Any tag" aria-label="Tag" style={{ width: 'auto' }} />}
            <Select sm value={sort} onChange={(e) => setSort(e.target.value as Sort)} options={[{ value: 'newest', label: 'Newest' }, { value: 'name', label: 'Name' }, { value: 'size', label: 'Size' }, { value: 'type', label: 'Type' }]} aria-label="Sort" style={{ width: 'auto' }} />
          </div>
          <div className={cn('lib__drop', dragging && 'lib__drop--on')}>
            <Upload /> Drop to upload {folder !== 'all' && folder !== 'none' && folders.find((f) => f.id === folder) ? `into “${folders.find((f) => f.id === folder)!.name}”` : ''}
          </div>
          {list.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={<FolderOpen />}
                title={assets.length ? 'No files here' : 'Your library is empty'}
                text={assets.length ? 'Try another folder or filter — or drop files anywhere on this page.' : 'Upload images, videos, audio, thumbnails and documents. Drag files anywhere on this page.'}
                actions={<Button variant="primary" icon={<Upload />} onClick={() => openModal({ kind: 'upload', defaults })}>Upload files</Button>}
              />
            </div>
          ) : view === 'grid' ? (
            <div className="asset-grid">
              {list.map((a) => (
                <div key={a.id} className="asset-card">
                  <button className="asset-card__open" onClick={() => openModal({ kind: 'asset', id: a.id })} aria-label={`Open ${a.name}`}>
                    <AssetThumb asset={a} className="asset-card__thumb" />
                    {a.projectIds.length > 0 && (
                      <span className="asset-card__linked badge">
                        <Link2 /> {a.projectIds.length}
                      </span>
                    )}
                  </button>
                  <div className="asset-card__info">
                    <div style={{ minWidth: 0 }} className="grow">
                      <div className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                      <div className="subtle" style={{ fontSize: 11.5, textTransform: 'capitalize' }}>{a.type} · {fmtBytes(a.size)}</div>
                    </div>
                    {assetMenu(a)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 56 }} />
                    <th>Name</th>
                    <th className="hide-mobile">Type</th>
                    <th className="hide-mobile">Folder</th>
                    <th className="num hide-mobile">Size</th>
                    <th className="hide-mobile">Added</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => openModal({ kind: 'asset', id: a.id })}>
                      <td>
                        <AssetThumb asset={a} style={{ width: 40, height: 40, borderRadius: 9 }} />
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{a.name}</div>
                        {a.tags.length > 0 && <div className="subtle" style={{ fontSize: 12 }}>{a.tags.map((t) => `#${t}`).join(' ')}</div>}
                      </td>
                      <td className="hide-mobile" style={{ textTransform: 'capitalize' }}>{a.type}</td>
                      <td className="hide-mobile subtle">{folders.find((f) => f.id === a.folderId)?.name ?? '—'}</td>
                      <td className="num hide-mobile">{fmtBytes(a.size)}</td>
                      <td className="hide-mobile subtle tnum">{fmtDate(a.createdAt, 'd MMM yy')}</td>
                      <td onClick={(e) => e.stopPropagation()}>{assetMenu(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
