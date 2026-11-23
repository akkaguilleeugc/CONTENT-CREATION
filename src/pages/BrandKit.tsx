import { Check, Copy, Download, ExternalLink, ImageIcon, MoreHorizontal, Palette as PaletteIcon, Pencil, Plus, Trash2, Type, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BrandMark, Wordmark } from '@/components/brand';
import { EmptyState, Menu } from '@/components/overlay';
import { Button, ChipToggle, Input, PageHeader, Tabs } from '@/components/ui';
import { AssetThumb, Dropzone, uploadFiles } from '@/features/assets';
import { ASSET_TYPES, REFERENCE_KINDS } from '@/lib/constants';
import { useStore } from '@/lib/store';
import type { BrandColor } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, contrastRatio, copyText, hexToRgb, readableOn } from '@/lib/utils';

type Tab = 'guidelines' | 'colors' | 'type' | 'references' | 'assets';

async function copyHex(hex: string) {
  const ok = await copyText(hex);
  toast(ok ? `${hex} copied` : 'Could not copy', { tone: ok ? 'success' : 'error' });
}

export default function BrandKit() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'guidelines';
  const colors = useStore((s) => s.colors);
  const refs = useStore((s) => s.references);
  const brandAssets = useStore((s) => s.assets.filter((a) => a.brand).length);
  return (
    <div className="page">
      <PageHeader
        title="Brand Kit"
        sub={<>The single source of truth for the KROOPY identity — logos, colour, type and references. <span className="accent-script">stay on brand</span></>}
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'guidelines', label: 'Guidelines' },
          { value: 'colors', label: 'Colours', count: colors.length },
          { value: 'type', label: 'Typography', count: 3 },
          { value: 'references', label: 'References', count: refs.length },
          { value: 'assets', label: 'Brand assets', count: brandAssets },
        ]}
      />
      <div style={{ marginTop: 20 }} key={tab} className="page-enter">
        {tab === 'guidelines' && <Guidelines />}
        {tab === 'colors' && <Colors />}
        {tab === 'type' && <Typography />}
        {tab === 'references' && <References />}
        {tab === 'assets' && <BrandAssets />}
      </div>
    </div>
  );
}

/* ═══════════════ Guidelines ═══════════════ */
function Guidelines() {
  const colors = useStore((s) => s.colors);
  const primary = colors.filter((c) => c.paletteId === 'palette-primary').sort((a, b) => a.order - b.order);
  return (
    <div className="col gap-24">
      <section className="brand-hero">
        <div className="brand-hero__copy">
          <span className="eyebrow" style={{ color: 'rgba(255,255,255,.6)' }}>Identity · v1</span>
          <h2 className="brand-hero__title">
            Blue does the work,
            <br />
            lime gets the <span className="accent-script">click</span>
            <span className="stop" />
          </h2>
          <p>Premium, minimal and editorial — with neon luxury reserved for moments that deserve it.</p>
        </div>
        <div className="brand-hero__logo">
          <Wordmark height={64} plate="lime" />
        </div>
      </section>

      <section>
        <h3 className="section-title">Logo</h3>
        <div className="logo-grid">
          <div className="logo-card logo-card--wide" style={{ background: 'var(--ice)' }}>
            <img src="/brand/kroopy-logo.png" alt="KROOPY logotype" />
            <LogoCaption title="Logotype · horizontal" file="/brand/original/1.png" note="Primary mark. Use wherever there is horizontal room." />
          </div>
          <div className="logo-card" style={{ background: 'var(--lime)' }}>
            <img src="/brand/kroopy-symbol.png" alt="KROOPY symbol" style={{ maxWidth: '46%' }} />
            <LogoCaption title="Symbol" file="/brand/original/2.png" note="Compact spaces: avatar, app icon, favicon." />
          </div>
        </div>
        <div className="eyebrow" style={{ margin: '18px 0 10px' }}>Approved display surfaces</div>
        <div className="surface-grid">
          {[
            { bg: '#FFFFFF', label: 'On white' },
            { bg: 'var(--ice)', label: 'On ice' },
            { bg: 'var(--lime)', label: 'On lime' },
            { bg: 'var(--neon-lime)', label: 'On neon lime' },
          ].map((s) => (
            <div key={s.label} className="surface" style={{ background: s.bg }}>
              <img src="/brand/kroopy-logo.png" alt="" />
              <span>{s.label}</span>
            </div>
          ))}
          <div className="surface surface--dark">
            <BrandMark size={44} />
            <span>On dark · always inside a lime plate</span>
          </div>
        </div>
        <div className="rules">
          <div className="rule rule--do">
            <h4><Check size={15} /> Do</h4>
            <ul>
              <li>Use the original files — never redraw the logo.</li>
              <li>Scale proportionally; keep clear space equal to the height of the “O” rings.</li>
              <li>Place the black artwork on white, ice or lime surfaces.</li>
              <li>On dark backgrounds, present it inside a lime or ice plate.</li>
              <li>Use the symbol below 120 px of available width.</li>
            </ul>
          </div>
          <div className="rule rule--dont">
            <h4><X size={15} /> Don’t</h4>
            <ul>
              <li>Recolour, outline, add shadows or effects to the logo.</li>
              <li>Stretch, rotate or change the proportions.</li>
              <li>Place it directly on Ink, Navy, Royal or busy imagery.</li>
              <li>Rebuild the wordmark with another typeface.</li>
              <li>Use Hot Pink behind the logo.</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h3 className="section-title">Palette</h3>
        <div className="pill-stack">
          {primary.map((c, i) => (
            <button key={c.id} className="pill-stack__item" style={{ background: c.hex, color: readableOn(c.hex), zIndex: primary.length - i }} onClick={() => copyHex(c.hex)} aria-label={`Copy ${c.name} ${c.hex}`}>
              <span className="pill-stack__name">{c.name}</span>
              <span className="pill-stack__meta mono">
                {c.hex}
                <small>{c.role.split('·')[0]}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="brand-gradient">
          <span className="mono">G R A D I E N T</span>
        </div>
        <p className="subtle" style={{ fontSize: 12.5, marginTop: 8 }}>The only approved gradient runs Ink → Navy → Royal → Lime → White. Use it for progress, pipelines and hero moments — never as a general background.</p>
      </section>

      <section>
        <h3 className="section-title">Type hierarchy</h3>
        <div className="type-stack panel">
          <div><span className="eyebrow">Display · Coolvetica</span><span className="display" style={{ fontSize: 56 }}>Create. Ship. Grow.</span></div>
          <div><span className="eyebrow">Accent · 212 Baby Girl</span><span className="accent-script" style={{ fontSize: 40, color: 'var(--positive-text)' }}>let’s create</span></div>
          <div><span className="eyebrow">Interface · Inter</span><span style={{ fontSize: 16 }}>Clean, legible text for forms, tables, data and long reading.</span></div>
        </div>
      </section>

      <section>
        <h3 className="section-title">Graphic language</h3>
        <div className="style-grid">
          <div className="style-card"><div className="style-demo style-demo--pills"><i /><i /><i /></div><b>Pills</b><span>Rounded capsules echo the palette sheet.</span></div>
          <div className="style-card"><div className="style-demo style-demo--glow"><i /></div><b>Controlled glow</b><span>Lime glow for progress, royal glow for focus.</span></div>
          <div className="style-card"><div className="style-demo style-demo--glass"><i /></div><b>Glass</b><span>Moderate blur for overlays only.</span></div>
          <div className="style-card"><div className="style-demo style-demo--stop"><span className="display">Brand</span><i /></div><b>The pink full stop</b><span>Hot Pink, used once per headline.</span></div>
        </div>
      </section>
    </div>
  );
}

function LogoCaption({ title, file, note }: { title: string; file: string; note: string }) {
  return (
    <div className="logo-card__caption">
      <div>
        <b>{title}</b>
        <span>{note}</span>
      </div>
      <a className="btn btn--sm" href={file} download>
        <Download /> Original PNG
      </a>
    </div>
  );
}

/* ═══════════════ Colours ═══════════════ */
function Swatch({ c }: { c: BrandColor }) {
  const store = useStore.getState();
  const onWhite = contrastRatio(c.hex, '#FFFFFF');
  const onInk = contrastRatio(c.hex, '#0B0F14');
  return (
    <div className="swatch">
      <button className="swatch__color" style={{ background: c.hex, color: readableOn(c.hex) }} onClick={() => copyHex(c.hex)} aria-label={`Copy ${c.hex}`}>
        <span className="swatch__copy"><Copy size={13} /> Copy</span>
        <span className="display" style={{ fontSize: 22 }}>{c.name}</span>
      </button>
      <div className="swatch__info">
        <div className="row between">
          <span className="mono" style={{ fontSize: 12.5 }}>{c.hex}</span>
          <Menu
            items={[
              { label: 'Copy HEX', icon: <Copy />, onSelect: () => copyHex(c.hex) },
              { label: 'Copy RGB', icon: <Copy />, onSelect: () => copyText(`rgb(${hexToRgb(c.hex)})`).then(() => toast('RGB copied')) },
              { label: 'Edit', icon: <Pencil />, onSelect: () => openModal({ kind: 'color', id: c.id }) },
              {
                label: 'Delete',
                icon: <Trash2 />,
                danger: true,
                separator: true,
                onSelect: async () => {
                  if (await confirmDialog({ title: `Delete ${c.name}?` })) {
                    store.remove('colors', c.id);
                    toast('Colour removed');
                  }
                },
              },
            ]}
            trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label="Colour actions" />}
          />
        </div>
        <span className="subtle mono" style={{ fontSize: 11 }}>RGB {hexToRgb(c.hex)}</span>
        {c.role && <span className="subtle" style={{ fontSize: 12 }}>{c.role}</span>}
        <div className="row" style={{ gap: 4, marginTop: 4 }}>
          <span className={cn('badge', onWhite >= 4.5 ? 'badge--positive' : '')} title="Contrast as text on white">W {onWhite.toFixed(1)}</span>
          <span className={cn('badge', onInk >= 4.5 ? 'badge--positive' : '')} title="Contrast as text on Ink">Ink {onInk.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

function Colors() {
  const rawPalettes = useStore((s) => s.palettes);
  const palettes = useMemo(() => [...rawPalettes].sort((a, b) => a.order - b.order), [rawPalettes]);
  const colors = useStore((s) => s.colors);
  const combos = useStore((s) => s.combos);
  return (
    <div className="col gap-24">
      <div className="row between wrap">
        <p className="subtle" style={{ fontSize: 13 }}>Click any swatch to copy its HEX. Contrast badges show WCAG ratios as text on white and on Ink.</p>
        <div className="row">
          <Button icon={<PaletteIcon />} onClick={() => openModal({ kind: 'palette' })}>New palette</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'color' })}>Add colour</Button>
        </div>
      </div>
      {palettes.map((p) => {
        const list = colors.filter((c) => c.paletteId === p.id).sort((a, b) => a.order - b.order);
        return (
          <section key={p.id}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="section-title" style={{ margin: 0 }}>{p.name}</h3>
                {p.description && <p className="subtle" style={{ fontSize: 12.5 }}>{p.description}</p>}
              </div>
              <div className="row" style={{ gap: 4 }}>
                <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => openModal({ kind: 'color', paletteId: p.id })}>Colour</Button>
                <Button size="sm" variant="ghost" iconOnly icon={<Pencil />} tip="Edit palette" onClick={() => openModal({ kind: 'palette', id: p.id })} />
              </div>
            </div>
            {list.length ? (
              <div className="swatch-grid">
                {list.map((c) => <Swatch key={c.id} c={c} />)}
              </div>
            ) : (
              <div className="panel"><EmptyState compact icon={<PaletteIcon />} title="Empty palette" actions={<Button size="sm" icon={<Plus />} onClick={() => openModal({ kind: 'color', paletteId: p.id })}>Add colour</Button>} /></div>
            )}
          </section>
        );
      })}
      <section>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Combinations</h3>
          <Button size="sm" icon={<Plus />} onClick={() => openModal({ kind: 'combo' })}>New combination</Button>
        </div>
        <div className="combo-grid">
          {combos.map((c) => {
            const r = contrastRatio(c.background, c.foreground);
            return (
              <button key={c.id} className="combo" onClick={() => openModal({ kind: 'combo', id: c.id })}>
                <div className="combo__preview" style={{ background: c.background, color: c.foreground }}>
                  <span className="display" style={{ fontSize: 34 }}>Aa<span style={{ color: c.accent ?? c.foreground }}>.</span></span>
                  {c.accent && <span className="combo__accent" style={{ background: c.accent }} />}
                </div>
                <div className="combo__info">
                  <b>{c.name}</b>
                  <span className={cn('badge', r >= 4.5 ? 'badge--positive' : r >= 3 ? '' : 'badge--danger')}>{r.toFixed(1)}:1</span>
                </div>
                <span className="subtle" style={{ fontSize: 12, textAlign: 'left' }}>{c.note}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════ Typography ═══════════════ */
const FONTS = [
  {
    name: 'Coolvetica',
    family: 'var(--font-display)',
    file: '/fonts/Coolvetica-Regular.otf',
    role: 'Display',
    uses: ['Headlines and page titles', 'Section names', 'Brand moments', 'Large numbers and KPIs'],
    sample: 'Create. Ship. Grow.',
  },
  {
    name: '212 Baby Girl',
    family: 'var(--font-accent)',
    file: '/fonts/212-Baby-Girl.otf',
    role: 'Accent',
    uses: ['Decorative accents', 'Short special phrases', 'Creative details'],
    rule: 'Never for long text or functional information.',
    sample: 'let’s create',
  },
  {
    name: 'Inter',
    family: 'var(--font-ui)',
    file: '',
    role: 'Interface',
    uses: ['Body and secondary text', 'Forms, tables and data', 'Anything that needs maximum legibility'],
    sample: 'The quick brown fox jumps over the lazy dog.',
  },
];
const SCALE = [
  { name: 'Display', size: 64, font: 'var(--font-display)', note: 'Coolvetica · −3% tracking' },
  { name: 'Heading 1', size: 48, font: 'var(--font-display)', note: 'Coolvetica · −2.5%' },
  { name: 'Heading 2', size: 26, font: 'var(--font-display)', note: 'Coolvetica · −1.5%' },
  { name: 'Heading 3', size: 19, font: 'var(--font-display)', note: 'Coolvetica · −1%' },
  { name: 'Accent', size: 28, font: 'var(--font-accent)', note: '212 Baby Girl · short phrases only' },
  { name: 'Body', size: 14, font: 'var(--font-ui)', note: 'Inter 400–600 · 1.5 line height' },
  { name: 'Caption', size: 12, font: 'var(--font-ui)', note: 'Inter 500' },
  { name: 'Eyebrow', size: 10.5, font: 'var(--font-mono)', note: 'Mono · uppercase · +16% tracking', upper: true },
];

function Typography() {
  const [text, setText] = useState('');
  const [size, setSize] = useState(56);
  return (
    <div className="col gap-24">
      <div className="toolbar" style={{ margin: 0 }}>
        <Input sm value={text} onChange={(e) => setText(e.target.value)} placeholder="Type to preview all brand fonts…" style={{ maxWidth: 420 }} aria-label="Preview text" />
        <label className="row subtle" style={{ fontSize: 12.5 }}>
          Size
          <input type="range" min={18} max={110} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Preview size" style={{ accentColor: 'var(--royal)' }} />
          <span className="tnum" style={{ width: 34 }}>{size}px</span>
        </label>
      </div>
      <div className="font-grid">
        {FONTS.map((f) => (
          <article key={f.name} className="font-card panel">
            <div className="row between">
              <span className="badge badge--accent"><Type /> {f.role}</span>
              {f.file && (
                <a className="btn btn--sm btn--ghost" href={f.file} download>
                  <Download /> .otf
                </a>
              )}
            </div>
            <div className="font-card__aa" style={{ fontFamily: f.family }}>Aa</div>
            <h3 className="font-card__name">{f.name}</h3>
            <div className="font-card__sample" style={{ fontFamily: f.family, fontSize: size }}>{text || f.sample}</div>
            <div className="font-card__glyphs" style={{ fontFamily: f.family }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 áéíóú ñ ¿? ¡! @#&</div>
            <ul className="font-card__uses">
              {f.uses.map((u) => <li key={u}><Check size={13} /> {u}</li>)}
              {f.rule && <li className="danger-text"><X size={13} /> {f.rule}</li>}
            </ul>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel__head"><h3 className="panel__title">Type scale</h3></div>
        <div className="panel__body">
          <div className="scale">
            {SCALE.map((s) => (
              <div key={s.name} className="scale__row">
                <span className="scale__meta"><b>{s.name}</b><span className="subtle">{s.size}px · {s.note}</span></span>
                <span className="truncate" style={{ fontFamily: s.font, fontSize: s.size, lineHeight: 1.1, textTransform: s.upper ? 'uppercase' : undefined, letterSpacing: s.upper ? '0.16em' : s.font.includes('display') ? '-0.02em' : undefined }}>
                  {text || (s.name === 'Accent' ? 'let’s create' : 'Content that moves')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════ References ═══════════════ */
function RefImage({ assetId }: { assetId?: string }) {
  const asset = useStore((s) => (assetId ? s.assets.find((a) => a.id === assetId) : undefined));
  if (!asset) return null;
  return <AssetThumb asset={asset} className="ref__img" />;
}

function References() {
  const refs = useStore((s) => s.references);
  const [kinds, setKinds] = useState<string[]>([]);
  const list = useMemo(() => refs.filter((r) => !kinds.length || kinds.includes(r.kind)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [refs, kinds]);
  return (
    <div className="col gap-16">
      <div className="row between wrap">
        <ChipToggle sm options={REFERENCE_KINDS.map((k) => ({ value: k.id, label: k.label }))} value={kinds} onChange={setKinds} />
        <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'reference' })}>Add reference</Button>
      </div>
      {refs.length === 0 ? (
        <div className="panel">
          <EmptyState icon={<ImageIcon />} title="Build your moodboard" text="Save design references, photography, screenshots and campaign ideas — with links, notes and tags." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'reference' })}>Add reference</Button>} />
        </div>
      ) : (
        <div className="ref-grid">
          {list.map((r) => (
            <article key={r.id} className="ref" onClick={() => openModal({ kind: 'reference', id: r.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openModal({ kind: 'reference', id: r.id })}>
              <RefImage assetId={r.assetId} />
              <div className="ref__body">
                <span className="eyebrow">{REFERENCE_KINDS.find((k) => k.id === r.kind)?.label}</span>
                <b>{r.title}</b>
                {r.notes && <p className="subtle line-clamp-3" style={{ fontSize: 12.5 }}>{r.notes}</p>}
                <div className="row wrap" style={{ gap: 4 }}>
                  {r.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
                  {/^https?:\/\//.test(r.url) && (
                    <a href={r.url} target="_blank" rel="noreferrer" className="ref__link" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={12} /> {new URL(r.url).hostname.replace(/^www\./, '')}
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Brand assets ═══════════════ */
function BrandAssets() {
  const assets = useStore((s) => s.assets);
  const [types, setTypes] = useState<string[]>([]);
  const list = assets.filter((a) => a.brand && (!types.length || types.includes(a.type)));
  const present = ASSET_TYPES.filter((t) => assets.some((a) => a.brand && a.type === t.id));
  return (
    <div className="col gap-16">
      <Dropzone
        onFiles={async (files) => {
          const c = await uploadFiles(files, { brand: true, type: 'graphic' });
          if (c.length) toast(`${c.length} brand asset${c.length > 1 ? 's' : ''} added`);
        }}
      >
        <Upload />
        <div className="dropzone__title">Add brand assets</div>
        <div className="dropzone__sub">Logos, covers, templates, graphic elements, video and social resources</div>
      </Dropzone>
      {present.length > 1 && <ChipToggle sm options={present.map((t) => ({ value: t.id, label: t.label }))} value={types} onChange={setTypes} />}
      <div className="asset-grid">
        {list.map((a) => (
          <button key={a.id} className="asset-card" onClick={() => openModal({ kind: 'asset', id: a.id })}>
            <AssetThumb asset={a} className="asset-card__thumb" />
            <div className="asset-card__info">
              <span className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
              <span className="subtle" style={{ fontSize: 11.5, textTransform: 'capitalize' }}>{a.type}{a.system ? ' · original' : ''}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
