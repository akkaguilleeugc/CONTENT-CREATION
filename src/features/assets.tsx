import { Download, FileAudio, FileText, FileVideo, ImageIcon, Trash2, Type, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isFontFile, previewFamily } from '@/lib/brandFonts';
import { ChipToggle, Field, Input, Select, Switch, TagInput, Textarea, Button } from '@/components/ui';
import { Modal } from '@/components/overlay';
import { ASSET_TYPES } from '@/lib/constants';
import { newAsset } from '@/lib/factories';
import { useAssetUrl } from '@/lib/hooks';
import { fileUrl, localFiles } from '@/lib/persistence';
import { useStore } from '@/lib/store';
import type { Asset, AssetType } from '@/lib/types';
import { closeModal, confirmDialog, toast } from '@/lib/ui';
import { cn, downloadBlob, fmtBytes, fmtDate, imageSize, uid } from '@/lib/utils';

import { $t } from '@/lib/i18n';
const MAX_BYTES = 200 * 1024 * 1024;

export function guessType(file: File): AssetType {
  if (isFontFile(file)) return 'font';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

/** Store files in IndexedDB and create their library records. */
export async function uploadFiles(files: File[], defaults: Partial<Asset> & { projectId?: string } = {}): Promise<Asset[]> {
  const store = useStore.getState();
  const created: Asset[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      toast($t('{name} is too large', { name: file.name }), { tone: 'error', description: $t("Files up to 200 MB are supported locally.") });
      continue;
    }
    const blobKey = `file-${uid()}`;
    try {
      await localFiles.put(blobKey, file);
    } catch (e) {
      console.error(e);
      toast($t('Could not store {name}', { name: file.name }), { tone: 'error', description: $t("Your browser storage may be full.") });
      continue;
    }
    const dims = await imageSize(file);
    const { projectId, ...rest } = defaults;
    const baseType = guessType(file);
    // A requested type wins for images (logo, cover…) and documents; fonts, video and audio keep their real kind.
    const type = rest.type && baseType !== 'font' && (baseType === 'image' || rest.type === 'document' || rest.type === baseType) ? rest.type : baseType;
    const asset = newAsset({
      ...rest,
      type,
      name: file.name.replace(/\.[^.]+$/, ''),
      mime: file.type || (baseType === 'font' ? `font/${file.name.split('.').pop()?.toLowerCase()}` : 'application/octet-stream'),
      size: file.size,
      blobKey,
      width: dims?.width,
      height: dims?.height,
      projectIds: projectId ? [projectId] : [],
      tags: rest.tags ?? [],
    });
    store.insert('assets', asset);
    if (projectId) store.linkAsset(asset.id, projectId, true);
    created.push(asset);
  }
  return created;
}

export async function downloadAsset(a: Asset) {
  if (a.blobKey) {
    const blob = await localFiles.get(a.blobKey);
    if (!blob) return toast($t("File not found in local storage"), { tone: 'error' });
    const ext = a.mime.split('/')[1]?.split('+')[0] ?? 'bin';
    downloadBlob(blob, `${a.name}.${ext}`);
  } else if (a.src) {
    const res = await fetch(a.src);
    downloadBlob(await res.blob(), a.src.split('/').pop() ?? a.name);
  }
}

export function TypeIcon({ a }: { a: Pick<Asset, 'mime' | 'type'> }) {
  if (a.type === 'font' || a.mime.startsWith('font/')) return <Type />;
  if (a.mime.startsWith('video/')) return <FileVideo />;
  if (a.mime.startsWith('audio/')) return <FileAudio />;
  if (a.mime.startsWith('image/')) return <ImageIcon />;
  return <FileText />;
}

/** Visual preview for any asset type. */
export function AssetThumb({ asset, className, style, fit = 'cover' }: { asset?: Asset; className?: string; style?: React.CSSProperties; fit?: 'cover' | 'contain' }) {
  const url = useAssetUrl(asset);
  const isImage = asset?.mime.startsWith('image/');
  const isVideo = asset?.mime.startsWith('video/');
  const isLogo = asset?.type === 'logo' || asset?.brand && asset?.system;
  return (
    <div className={cn('thumb', isLogo && 'thumb--logo', className)} style={style}>
      {asset && url && isImage ? (
        <img src={url} alt={asset.name} loading="lazy" style={{ objectFit: isLogo ? 'contain' : fit, padding: isLogo ? '18%' : undefined }} />
      ) : asset && asset.type === 'font' ? (
        <FontThumb asset={asset} />
      ) : asset && url && isVideo ? (
        <video src={url} muted playsInline preload="metadata" />
      ) : asset ? (
        <TypeIcon a={asset} />
      ) : (
        <ImageIcon />
      )}
    </div>
  );
}

function FontSample({ asset }: { asset: Asset }) {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => void previewFamily(asset).then(setFamily), [asset]);
  return (
    <div style={{ fontFamily: family ? `"${family}"` : undefined, fontSize: 22, textAlign: 'center', lineHeight: 1.4 }}>
      {$t("ABCDEFGHIJKLMNOPQRSTUVWXYZ")}
      <br />
      {$t("abcdefghijklmnopqrstuvwxyz 0123456789")}
    </div>
  );
}

function FontThumb({ asset, size = 44 }: { asset: Asset; size?: number }) {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    previewFamily(asset).then((f) => alive && setFamily(f));
    return () => {
      alive = false;
    };
  }, [asset]);
  return <span style={{ fontFamily: family ? `"${family}"` : undefined, fontSize: size, lineHeight: 1 }}>{$t("Aa")}</span>;
}

/* ════════════════════════ Upload dialog ════════════════════════ */
export function Dropzone({ onFiles, accept, children, compact }: { onFiles: (f: File[]) => void; accept?: string; children?: ReactNode; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn('dropzone', over && 'dropzone--over', compact && 'dropzone--compact')}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      {children ?? (
        <>
          <UploadCloud />
          <div className="dropzone__title">{$t("Drop files here or click to browse")}</div>
          <div className="dropzone__sub">{$t("Images, video, audio, fonts and documents · up to 200 MB each · stored privately in this browser")}</div>
        </>
      )}
    </div>
  );
}

export function UploadModal({ defaults = {}, files: initialFiles }: { defaults?: Partial<Asset> & { projectId?: string; referenceId?: string }; files?: File[] }) {
  const folders = useStore((s) => s.folders);
  const projects = useStore((s) => s.projects);
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [type, setType] = useState<AssetType | ''>(defaults.type ?? '');
  const [folderId, setFolderId] = useState(defaults.folderId ?? '');
  const [projectId, setProjectId] = useState(defaults.projectId ?? '');
  const [brand, setBrand] = useState(!!defaults.brand);
  const [tags, setTags] = useState<string[]>(defaults.tags ?? []);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!files.length) return toast($t("Choose at least one file"), { tone: 'error' });
    setBusy(true);
    const { referenceId, ...rest } = defaults as typeof defaults & { referenceId?: string };
    const created = await uploadFiles(files, { ...rest, type: type || undefined, folderId: folderId || undefined, projectId: projectId || undefined, brand, tags });
    setBusy(false);
    if (referenceId && created[0]) useStore.getState().update('references', referenceId, { assetId: created[0].id });
    if (created.length) {
      closeModal();
      toast(created.length > 1 ? $t('{n} files uploaded', { n: created.length }) : $t('1 file uploaded'), { description: created.map((a) => a.name).join(', ') });
      created.forEach((a) => a.blobKey && fileUrl(a.blobKey));
    }
  };

  return (
    <Modal
      open
      onClose={closeModal}
      size="lg"
      title={$t("Upload assets")}
      description={$t("Files stay on this device (IndexedDB) and keep their links to your videos.")}
      footer={
        <>
          <span className="spacer" />
          <Button onClick={closeModal}>{$t("Cancel")}</Button>
          <Button variant="primary" loading={busy} onClick={submit} disabled={!files.length || busy}>
            {$t("Upload")} {files.length ? (files.length > 1 ? $t('{n} files', { n: files.length }) : $t('1 file')) : ''}
          </Button>
        </>
      }
    >
      <div className="form">
        <Dropzone onFiles={(f) => setFiles((p) => [...p, ...f])} />
        {files.length > 0 && (
          <div className="col" style={{ gap: 4 }}>
            {files.map((f, i) => (
              <div key={i} className="row list-row">
                <TypeIcon a={{ mime: f.type, type: guessType(f) }} />
                <span className="grow truncate">{f.name}</span>
                <span className="subtle tnum">{fmtBytes(f.size)}</span>
                <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label={$t('Remove {name}', { name: f.name })} />
              </div>
            ))}
          </div>
        )}
        <div className="form-grid">
          <Field label={$t("Type")} hint={$t("Auto-detected when left empty.")}>
            <Select value={type} onChange={(e) => setType(e.target.value as AssetType)} options={ASSET_TYPES.map((t) => ({ value: t.id, label: t.label.replace(/s$/, '') }))} placeholder={$t("Auto")} />
          </Field>
          <Field label={$t("Folder")}>
            <Select value={folderId} onChange={(e) => setFolderId(e.target.value)} options={folders.map((f) => ({ value: f.id, label: f.name }))} placeholder={$t("No folder")} />
          </Field>
          <Field label={$t("Link to video")} className="span-2">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.title || $t("Untitled") }))} placeholder={$t("Not linked")} />
          </Field>
          <Field label={$t("Tags")} className="span-2">
            <TagInput value={tags} onChange={setTags} />
          </Field>
          <div className="span-2 row between">
            <span className="field__label">{$t("Add to Brand Kit")}</span>
            <Switch checked={brand} onChange={setBrand} label={$t("Add to Brand Kit")} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════ Asset detail ════════════════════════ */
export function AssetModal({ id }: { id: string }) {
  const asset = useStore((s) => s.assets.find((a) => a.id === id));
  const folders = useStore((s) => s.folders);
  const projects = useStore((s) => s.projects);
  const url = useAssetUrl(asset);
  const [draft, setDraft] = useState(asset ? { name: asset.name, type: asset.type, folderId: asset.folderId ?? '', tags: asset.tags, note: asset.note, brand: asset.brand } : null);
  const store = useStore.getState();
  if (!asset || !draft) return null;

  const save = () => {
    if (!draft.name.trim()) return toast($t("Name cannot be empty"), { tone: 'error' });
    store.update('assets', asset.id, { ...draft, name: draft.name.trim(), folderId: draft.folderId || undefined });
    closeModal();
    toast($t("Asset updated"));
  };

  const linked = asset.projectIds;
  return (
    <Modal
      open
      onClose={closeModal}
      size="xl"
      title={asset.name}
      description={`${asset.mime || asset.type} · ${fmtBytes(asset.size)}${asset.width ? ` · ${asset.width}×${asset.height}` : ''} · ${$t('added {date}', { date: fmtDate(asset.createdAt, 'd MMM yyyy') })}`}
      initialFocus={false}
      footer={
        <>
          {!asset.system && (
            <Button
              variant="danger-ghost"
              icon={<Trash2 />}
              onClick={async () => {
                if (await confirmDialog({ title: $t('Delete “{name}”?', { name: asset.name }), description: linked.length ? $t('It is linked to {n} video(s); the links are removed too.', { n: linked.length }) : $t("The file is removed from this device.") })) {
                  await store.deleteAsset(asset.id);
                  closeModal();
                  toast($t("Asset deleted"));
                }
              }}
            >
              {$t("Delete")}
            </Button>
          )}
          <span className="spacer" />
          <Button icon={<Download />} onClick={() => downloadAsset(asset)}>
            {$t("Download")}
          </Button>
          <Button variant="primary" onClick={save}>
            {$t("Save")}
          </Button>
        </>
      }
    >
      <div className="asset-detail">
        <div className={cn('asset-detail__preview', asset.type === 'logo' && 'asset-detail__preview--logo')}>
          {url && asset.mime.startsWith('image/') && <img src={url} alt={asset.name} />}
          {url && asset.mime.startsWith('video/') && <video src={url} controls playsInline />}
          {url && asset.mime.startsWith('audio/') && (
            <div className="col" style={{ alignItems: 'center', gap: 18, width: '100%', padding: 24 }}>
              <FileAudio size={42} />
              <audio src={url} controls style={{ width: '100%' }} />
            </div>
          )}
          {url && asset.mime === 'application/pdf' && <iframe src={url} title={asset.name} />}
          {asset.type === 'font' && (
            <div className="col" style={{ alignItems: 'center', gap: 14, padding: 24, color: 'var(--text)' }}>
              <FontThumb asset={asset} size={120} />
              <FontSample asset={asset} />
            </div>
          )}
          {asset.type !== 'font' && (!url || (!/^(image|video|audio)\//.test(asset.mime) && asset.mime !== 'application/pdf')) && (
            <div className="col" style={{ alignItems: 'center', gap: 10, color: 'var(--text-3)' }}>
              <FileText size={40} />
              {$t("No inline preview for this file type — download to open it.")}
            </div>
          )}
        </div>
        <div className="form">
          <Field label={$t("Name")}>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={asset.system} />
          </Field>
          <div className="form-grid">
            <Field label={$t("Type")}>
              <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as AssetType })} options={ASSET_TYPES.map((t) => ({ value: t.id, label: t.label.replace(/s$/, '') }))} />
            </Field>
            <Field label={$t("Folder")}>
              <Select value={draft.folderId} onChange={(e) => setDraft({ ...draft, folderId: e.target.value })} options={folders.map((f) => ({ value: f.id, label: f.name }))} placeholder={$t("No folder")} />
            </Field>
          </div>
          <Field label={$t("Tags")}>
            <TagInput value={draft.tags} onChange={(t) => setDraft({ ...draft, tags: t })} />
          </Field>
          <Field label={$t("Notes")}>
            <Textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} style={{ minHeight: 60 }} />
          </Field>
          <div className="row between">
            <span className="field__label">{$t("In Brand Kit")}</span>
            <Switch checked={draft.brand} onChange={(b) => setDraft({ ...draft, brand: b })} label={$t("In Brand Kit")} />
          </div>
          <Field label={$t("Linked videos")} hint={projects.length ? $t("Toggle to link or unlink — saved instantly.") : $t("Create a video in Content Studio to link files.")}>
            <ChipToggle options={projects.map((p) => ({ value: p.id, label: p.title || $t("Untitled") }))} value={linked} onChange={(next) => {
              for (const p of projects) {
                const was = linked.includes(p.id);
                const is = next.includes(p.id);
                if (was !== is) store.linkAsset(asset.id, p.id, is);
              }
            }} sm />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
