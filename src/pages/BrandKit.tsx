import {
  Check,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  MoreHorizontal,
  Palette as PaletteIcon,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, Menu } from '@/components/overlay';
import { Button, ChipToggle, Input, PageHeader, Tabs } from '@/components/ui';
import { AssetThumb, Dropzone, downloadAsset, uploadFiles } from '@/features/assets';
import { fontStack, useFontsVersion } from '@/lib/brandFonts';
import { ASSET_TYPES, FONT_ROLES, REFERENCE_KINDS } from '@/lib/constants';
import { useAssetUrl } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import type { Asset, BrandColor, BrandFont } from '@/lib/types';
import { confirmDialog, openModal, toast } from '@/lib/ui';
import { cn, contrastRatio, copyText, hexToRgb, isHex, readableOn } from '@/lib/utils';

type Tab = 'guidelines' | 'colors' | 'type' | 'references' | 'assets';

async function copyHex(hex: string) {
  const ok = await copyText(hex);
  toast(ok ? `${hex} copied` : 'Could not copy', { tone: ok ? 'success' : 'error' });
}

function useOrderedColors() {
  const palettes = useStore((s) => s.palettes);
  const colors = useStore((s) => s.colors);
  return useMemo(() => {
    const order = new Map([...palettes].sort((a, b) => a.order - b.order).map((p, i) => [p.id, i]));
    return [...colors].sort((a, b) => (order.get(a.paletteId) ?? 99) - (order.get(b.paletteId) ?? 99) || a.order - b.order);
  }, [palettes, colors]);
}

function useFontsByRole() {
  const fonts = useStore((s) => s.brandFonts);
  useFontsVersion();
  return useMemo(() => {
    const sorted = [...fonts].sort((a, b) => a.order - b.order);
    return { all: sorted, display: sorted.find((f) => f.role === 'display'), text: sorted.find((f) => f.role === 'text'), accent: sorted.find((f) => f.role === 'accent') };
  }, [fonts]);
}

export default function BrandKit() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'guidelines';
  const brand = useStore((s) => s.brand);
  const colors = useStore((s) => s.colors.length);
  const fonts = useStore((s) => s.brandFonts.length);
  const refs = useStore((s) => s.references.length);
  const brandAssets = useStore((s) => s.assets.filter((a) => a.brand).length);
  return (
    <div className="page">
      <PageHeader
        title="Brand Kit"
        sub={brand.name ? <>The single source of truth for <b>{brand.name}</b> — logos, colours, type, rules and references.</> : 'Your brand’s single source of truth. Fill it with your own logos, colours, fonts, rules and references.'}
        actions={
          <Button icon={<Pencil />} onClick={() => openModal({ kind: 'brand' })}>
            {brand.name ? 'Edit brand' : 'Set up brand'}
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'guidelines', label: 'Guidelines' },
          { value: 'colors', label: 'Colours', count: colors },
          { value: 'type', label: 'Typography', count: fonts },
          { value: 'references', label: 'References', count: refs },
          { value: 'assets', label: 'Brand assets', count: brandAssets },
        ]}
      />
      <div style={{ marginTop: 20 }} key={tab} className="page-enter">
        {tab === 'guidelines' && <Guidelines goTo={(t) => setParams({ tab: t })} />}
        {tab === 'colors' && <Colors />}
        {tab === 'type' && <Typography />}
        {tab === 'references' && <References />}
        {tab === 'assets' && <BrandAssets />}
      </div>
    </div>
  );
}

/* ═══════════════ Guidelines (built from your data) ═══════════════ */
function useLogoUpload(slot: 'logoAssetId' | 'symbolAssetId') {
  const input = useRef<HTMLInputElement>(null);
  const el = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const [a] = await uploadFiles([f], { type: 'logo', brand: true, tags: [slot === 'logoAssetId' ? 'logo' : 'symbol'] });
        if (a) {
          useStore.getState().setBrand({ [slot]: a.id });
          toast(slot === 'logoAssetId' ? 'Logo uploaded' : 'Symbol uploaded');
        }
      }}
    />
  );
  return { open: () => input.current?.click(), el };
}

function Guidelines({ goTo }: { goTo: (t: Tab) => void }) {
  const brand = useStore((s) => s.brand);
  const assets = useStore((s) => s.assets);
  const colors = useOrderedColors();
  const fonts = useFontsByRole();
  const logo = assets.find((a) => a.id === brand.logoAssetId);
  const symbol = assets.find((a) => a.id === brand.symbolAssetId);
  const logoUp = useLogoUpload('logoAssetId');
  const symUp = useLogoUpload('symbolAssetId');

  const steps = [
    { done: !!brand.name, label: 'Name & story', hint: 'Name, tagline, description and voice', action: () => openModal({ kind: 'brand' }), cta: 'Add details' },
    { done: !!logo, label: 'Logo', hint: 'Upload your primary logo', action: logoUp.open, cta: 'Upload logo' },
    { done: colors.length > 0, label: 'Colours', hint: 'Create a palette with your HEX codes', action: () => (useStore.getState().palettes.length ? openModal({ kind: 'color' }) : openModal({ kind: 'palette' })), cta: 'Add colours' },
    { done: fonts.all.length > 0, label: 'Fonts', hint: 'Upload your typefaces', action: () => openModal({ kind: 'font' }), cta: 'Add font' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const heroBg = colors[0]?.hex;

  return (
    <div className="col gap-24">
      {logoUp.el}
      {symUp.el}
      {doneCount < steps.length && (
        <section className="panel setup">
          <div className="setup__head">
            <span className="setup__badge"><Sparkles size={15} /> {doneCount}/{steps.length}</span>
            <div>
              <h3 className="panel__title">Set up your brand</h3>
              <p className="subtle" style={{ fontSize: 13 }}>Nothing here is pre-filled — every guideline below is generated from what you add.</p>
            </div>
          </div>
          <div className="setup__steps">
            {steps.map((s, i) => (
              <div key={s.label} className={cn('setup__step', s.done && 'setup__step--done')}>
                <span className="setup__num">{s.done ? <Check size={14} /> : i + 1}</span>
                <div className="grow">
                  <b>{s.label}</b>
                  <span>{s.hint}</span>
                </div>
                {!s.done && (
                  <Button size="sm" variant={i === doneCount ? 'primary' : 'default'} onClick={s.action}>
                    {s.cta}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(brand.name || logo) && (
        <section className="my-hero" style={heroBg ? { ['--hero' as string]: heroBg, color: readableOn(heroBg) } : undefined}>
          <div className="my-hero__copy">
            {brand.voice.length > 0 && <span className="eyebrow" style={{ color: 'inherit', opacity: 0.65 }}>{brand.voice.join(' · ')}</span>}
            <h2 className="my-hero__name" style={{ fontFamily: fonts.display ? fontStack(fonts.display) : undefined }}>{brand.name || 'Your brand'}</h2>
            {brand.tagline && <p className="my-hero__tagline" style={{ fontFamily: fonts.accent ? fontStack(fonts.accent) : undefined }}>{brand.tagline}</p>}
            {brand.description && <p className="my-hero__desc" style={{ fontFamily: fonts.text ? fontStack(fonts.text) : undefined }}>{brand.description}</p>}
          </div>
          {logo && (
            <div className="my-hero__logo" style={{ background: brand.logoBackground }}>
              <LogoImg asset={logo} />
            </div>
          )}
        </section>
      )}

      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Logo</h3>
          <Button size="sm" variant="ghost" icon={<Upload />} onClick={() => openModal({ kind: 'upload', defaults: { type: 'logo', brand: true } })}>
            Upload variant
          </Button>
        </div>
        <div className="logo-grid">
          <LogoSlot title="Primary logo" note="Your main mark — used wherever there is room." asset={logo} bg={brand.logoBackground} onUpload={logoUp.open} onClear={() => useStore.getState().setBrand({ logoAssetId: undefined })} />
          <LogoSlot title="Symbol" note="Compact mark for avatars, icons and small spaces." asset={symbol} bg={brand.logoBackground} onUpload={symUp.open} onClear={() => useStore.getState().setBrand({ symbolAssetId: undefined })} />
        </div>
        <LogoVariants exclude={[brand.logoAssetId, brand.symbolAssetId]} />
        {logo && colors.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '18px 0 10px' }}>Your logo on your colours</div>
            <div className="surface-grid">
              {colors.slice(0, 5).map((c) => (
                <div key={c.id} className="surface" style={{ background: c.hex, color: readableOn(c.hex) }}>
                  <LogoImg asset={logo} />
                  <span style={{ color: 'inherit', opacity: 0.7 }}>
                    {c.name} · {contrastRatio(c.hex, readableOn(c.hex)) >= 4.5 ? 'text OK' : 'check legibility'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Palette</h3>
          <Button size="sm" variant="ghost" onClick={() => goTo('colors')}>Manage colours</Button>
        </div>
        {colors.length === 0 ? (
          <div className="panel"><EmptyState compact icon={<PaletteIcon />} title="No colours yet" text="Add your brand colours with their HEX codes — the palette, gradient and contrast checks build themselves." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: useStore.getState().palettes.length ? 'color' : 'palette' })}>Add colours</Button>} /></div>
        ) : (
          <>
            <div className="pill-stack">
              {colors.slice(0, 6).map((c, i) => (
                <button key={c.id} className="pill-stack__item" style={{ background: c.hex, color: readableOn(c.hex), zIndex: i + 1 }} onClick={() => copyHex(c.hex)} aria-label={`Copy ${c.name} ${c.hex}`}>
                  <span className="pill-stack__name" style={{ fontFamily: fonts.display ? fontStack(fonts.display) : undefined }}>{c.name}</span>
                  <span className="pill-stack__meta mono">
                    {c.hex}
                    {c.role && <small>{c.role}</small>}
                  </span>
                </button>
              ))}
            </div>
            {colors.length > 1 && (
              <div className="brand-gradient" style={{ background: `linear-gradient(90deg, ${colors.slice(0, 5).map((c) => c.hex).join(', ')})` }}>
                <span className="mono" style={{ color: readableOn(colors[Math.floor(Math.min(4, colors.length - 1) / 2)]!.hex) }}>G R A D I E N T</span>
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Type hierarchy</h3>
          <Button size="sm" variant="ghost" onClick={() => goTo('type')}>Manage fonts</Button>
        </div>
        {fonts.all.length === 0 ? (
          <div className="panel"><EmptyState compact icon={<Type />} title="No fonts yet" text="Upload your typefaces (.otf, .ttf, .woff) and give each a role — display, text or accent." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'font' })}>Add font</Button>} /></div>
        ) : (
          <div className="type-stack panel">
            {fonts.all.map((f) => (
              <div key={f.id}>
                <span className="eyebrow">{FONT_ROLES.find((r) => r.id === f.role)?.label} · {f.name}</span>
                <span style={{ fontFamily: fontStack(f), fontSize: f.role === 'display' ? 52 : f.role === 'accent' ? 38 : 17, lineHeight: 1.15 }}>{f.sample || (f.role === 'text' ? 'Clear, readable copy for everything people need to read.' : brand.name || 'Your brand')}</span>
                {f.usage && <span className="subtle" style={{ fontSize: 12.5 }}>{f.usage}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">Usage rules</h3>
        <div className="rules">
          <RuleList kind="do" />
          <RuleList kind="dont" />
        </div>
      </section>
    </div>
  );
}

function LogoImg({ asset }: { asset: Asset }) {
  const url = useAssetUrl(asset);
  return url ? <img src={url} alt={asset.name} /> : <ImageIcon />;
}

function LogoSlot({ title, note, asset, bg, onUpload, onClear }: { title: string; note: string; asset?: Asset; bg: string; onUpload: () => void; onClear: () => void }) {
  return (
    <div className={cn('logo-card', !asset && 'logo-card--empty')} style={asset ? { background: isHex(bg) ? bg : '#fff', color: readableOn(isHex(bg) ? bg : '#fff') } : undefined}>
      {asset ? <LogoImg asset={asset} /> : (
        <button className="logo-card__add" onClick={onUpload}>
          <Upload />
          <span>Upload {title.toLowerCase()}</span>
        </button>
      )}
      <div className="logo-card__caption">
        <div>
          <b>{title}</b>
          <span>{asset ? asset.name : note}</span>
        </div>
        {asset && (
          <div className="row" style={{ gap: 4 }}>
            <Button size="sm" iconOnly icon={<Download />} tip="Download original" onClick={() => downloadAsset(asset)} />
            <Button size="sm" iconOnly icon={<Upload />} tip="Replace" onClick={onUpload} />
            <Button size="sm" iconOnly icon={<X />} tip="Unset" onClick={onClear} />
          </div>
        )}
      </div>
    </div>
  );
}

function LogoVariants({ exclude }: { exclude: (string | undefined)[] }) {
  const assets = useStore((s) => s.assets);
  const list = assets.filter((a) => a.brand && a.type === 'logo' && !exclude.includes(a.id));
  if (!list.length) return null;
  return (
    <>
      <div className="eyebrow" style={{ margin: '18px 0 10px' }}>Other logo files</div>
      <div className="asset-grid">
        {list.map((a) => (
          <div key={a.id} className="asset-card">
            <button className="asset-card__open" onClick={() => openModal({ kind: 'asset', id: a.id })}>
              <AssetThumb asset={a} className="asset-card__thumb" fit="contain" />
            </button>
            <div className="asset-card__info">
              <span className="truncate grow" style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
              <Menu
                items={[
                  { label: 'Set as primary logo', icon: <Check />, onSelect: () => useStore.getState().setBrand({ logoAssetId: a.id }) },
                  { label: 'Set as symbol', icon: <Check />, onSelect: () => useStore.getState().setBrand({ symbolAssetId: a.id }) },
                  { label: 'Download', icon: <Download />, onSelect: () => downloadAsset(a) },
                ]}
                trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />} aria-label="Logo actions" />}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function RuleList({ kind }: { kind: 'do' | 'dont' }) {
  const list = useStore((s) => (kind === 'do' ? s.brand.doList : s.brand.dontList));
  const [draft, setDraft] = useState('');
  const key = kind === 'do' ? 'doList' : 'dontList';
  const setList = (v: string[]) => useStore.getState().setBrand({ [key]: v });
  const add = () => {
    if (!draft.trim()) return;
    setList([...list, draft.trim()]);
    setDraft('');
  };
  return (
    <div className={cn('rule', kind === 'do' ? 'rule--do' : 'rule--dont')}>
      <h4>{kind === 'do' ? <Check size={15} /> : <X size={15} />} {kind === 'do' ? 'Do' : 'Don’t'}</h4>
      <ul>
        {list.map((r, i) => (
          <li key={i} className="row between">
            <span>{r}</span>
            <button className="rule__x" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Remove rule"><X size={13} /></button>
          </li>
        ))}
        {!list.length && <li className="subtle">No rules yet.</li>}
      </ul>
      <form className="row mt-8" onSubmit={(e) => (e.preventDefault(), add())}>
        <Input sm value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={kind === 'do' ? 'Add something to always do…' : 'Add something to avoid…'} aria-label={kind === 'do' ? 'New do rule' : 'New don’t rule'} />
        <Button size="sm" type="submit" icon={<Plus />}>Add</Button>
      </form>
    </div>
  );
}

/* ═══════════════ Colours ═══════════════ */
function Swatch({ c }: { c: BrandColor }) {
  const store = useStore.getState();
  const onWhite = contrastRatio(c.hex, '#FFFFFF');
  const onBlack = contrastRatio(c.hex, '#000000');
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
          <span className={cn('badge', onWhite >= 4.5 ? 'badge--positive' : '')} title="Contrast as text on white">White {onWhite.toFixed(1)}</span>
          <span className={cn('badge', onBlack >= 4.5 ? 'badge--positive' : '')} title="Contrast as text on black">Black {onBlack.toFixed(1)}</span>
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
  if (!palettes.length)
    return (
      <div className="panel">
        <EmptyState
          icon={<PaletteIcon />}
          title="Create your first palette"
          text="Group your colours into palettes (e.g. Primary, Secondary, Campaign) and add each one with its HEX code."
          actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'palette' })}>New palette</Button>}
        />
      </div>
    );
  return (
    <div className="col gap-24">
      <div className="row between wrap">
        <p className="subtle" style={{ fontSize: 13 }}>Click a swatch to copy its HEX. Badges show WCAG contrast as text on white and on black.</p>
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
              <div className="swatch-grid">{list.map((c) => <Swatch key={c.id} c={c} />)}</div>
            ) : (
              <div className="panel"><EmptyState compact icon={<PaletteIcon />} title="Empty palette" actions={<Button size="sm" icon={<Plus />} onClick={() => openModal({ kind: 'color', paletteId: p.id })}>Add colour</Button>} /></div>
            )}
          </section>
        );
      })}
      <section>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Combinations</h3>
          <Button size="sm" icon={<Plus />} onClick={() => openModal({ kind: 'combo' })} disabled={!colors.length}>New combination</Button>
        </div>
        {combos.length === 0 ? (
          <p className="subtle" style={{ fontSize: 13 }}>Save approved background / text / accent pairings and check their contrast.</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}

/* ═══════════════ Typography ═══════════════ */
function Typography() {
  const { all } = useFontsByRole();
  const brandName = useStore((s) => s.brand.name);
  const [text, setText] = useState('');
  const [size, setSize] = useState(56);
  if (!all.length)
    return (
      <div className="panel">
        <EmptyState
          icon={<Type />}
          title="Add your brand fonts"
          text="Upload .otf, .ttf, .woff or .woff2 files (or use a font installed on this device). Each gets a role and usage notes, and every preview renders in the real typeface."
          actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'font' })}>Add font</Button>}
        />
      </div>
    );
  const scale: { name: string; size: number; f?: BrandFont }[] = [
    { name: 'Display', size: 64, f: all.find((x) => x.role === 'display') },
    { name: 'Heading', size: 40, f: all.find((x) => x.role === 'display') },
    { name: 'Subheading', size: 24, f: all.find((x) => x.role === 'display') ?? all.find((x) => x.role === 'text') },
    { name: 'Accent', size: 30, f: all.find((x) => x.role === 'accent') },
    { name: 'Body', size: 16, f: all.find((x) => x.role === 'text') },
    { name: 'Caption', size: 12, f: all.find((x) => x.role === 'text') },
  ].filter((r) => r.f);
  return (
    <div className="col gap-24">
      <div className="toolbar" style={{ margin: 0 }}>
        <Input sm value={text} onChange={(e) => setText(e.target.value)} placeholder="Type to preview all your fonts…" style={{ maxWidth: 420 }} aria-label="Preview text" />
        <label className="row subtle" style={{ fontSize: 12.5 }}>
          Size
          <input type="range" min={18} max={110} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Preview size" style={{ accentColor: 'var(--royal)' }} />
          <span className="tnum" style={{ width: 34 }}>{size}px</span>
        </label>
        <Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'font' })} style={{ marginLeft: 'auto' }}>Add font</Button>
      </div>
      <div className="font-grid">
        {all.map((f) => (
          <FontCard key={f.id} f={f} text={text} size={size} />
        ))}
      </div>
      {scale.length > 0 && (
        <section className="panel">
          <div className="panel__head"><h3 className="panel__title">Type scale</h3></div>
          <div className="panel__body">
            <div className="scale">
              {scale.map((s) => (
                <div key={s.name} className="scale__row">
                  <span className="scale__meta"><b>{s.name}</b><span className="subtle">{s.size}px · {s.f!.name}</span></span>
                  <span className="truncate" style={{ fontFamily: fontStack(s.f), fontSize: s.size, lineHeight: 1.15 }}>{text || s.f!.sample || brandName || 'Content that moves'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function FontCard({ f, text, size }: { f: BrandFont; text: string; size: number }) {
  const asset = useStore((s) => (f.assetId ? s.assets.find((a) => a.id === f.assetId) : undefined));
  return (
    <article className="font-card panel">
      <div className="row between">
        <span className="badge badge--accent"><Type /> {FONT_ROLES.find((r) => r.id === f.role)?.label}</span>
        <div className="row" style={{ gap: 2 }}>
          {asset && <Button size="sm" variant="ghost" iconOnly icon={<Download />} tip="Download file" onClick={() => downloadAsset(asset)} />}
          <Button size="sm" variant="ghost" iconOnly icon={<Pencil />} tip="Edit" onClick={() => openModal({ kind: 'font', id: f.id })} />
        </div>
      </div>
      <div className="font-card__aa" style={{ fontFamily: fontStack(f) }}>Aa</div>
      <h3 className="font-card__name">{f.name}</h3>
      <span className="subtle" style={{ fontSize: 12 }}>{asset ? `${asset.name} · uploaded file` : `Installed font · ${f.family}`}</span>
      <div className="font-card__sample" style={{ fontFamily: fontStack(f), fontSize: size }}>{text || f.sample || f.name}</div>
      <div className="font-card__glyphs" style={{ fontFamily: fontStack(f) }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 áéíóú ñ ¿? ¡! @#&</div>
      {f.usage && <p className="subtle" style={{ fontSize: 12.5 }}>{f.usage}</p>}
    </article>
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
          <EmptyState icon={<ImageIcon />} title="Build your moodboard" text="Save design references, photography, screenshots and campaign ideas for your brand — with links, notes and tags." actions={<Button variant="primary" icon={<Plus />} onClick={() => openModal({ kind: 'reference' })}>Add reference</Button>} />
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
                      <ExternalLink size={12} /> {safeHost(r.url)}
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

const safeHost = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

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
        <div className="dropzone__title">Add your brand assets</div>
        <div className="dropzone__sub">Logos, covers, templates, graphic elements, fonts, video and social resources</div>
      </Dropzone>
      {present.length > 1 && <ChipToggle sm options={present.map((t) => ({ value: t.id, label: t.label }))} value={types} onChange={setTypes} />}
      {list.length === 0 ? (
        <p className="subtle" style={{ fontSize: 13 }}>Nothing here yet. Everything you upload here — or mark as “In Brand Kit” in the Asset Library — appears in this tab.</p>
      ) : (
        <div className="asset-grid">
          {list.map((a) => (
            <button key={a.id} className="asset-card" onClick={() => openModal({ kind: 'asset', id: a.id })}>
              <AssetThumb asset={a} className="asset-card__thumb" fit={a.type === 'logo' ? 'contain' : 'cover'} />
              <div className="asset-card__info">
                <span className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                <span className="subtle" style={{ fontSize: 11.5, textTransform: 'capitalize' }}>{a.type}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

