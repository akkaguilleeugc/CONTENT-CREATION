/* Registers the user's uploaded brand fonts with the browser (FontFace API) so every
   specimen, preview and guideline renders in the real typeface. */
import { useEffect, useState } from 'react';
import { localFiles } from './persistence';
import { useStore } from './store';
import type { Asset, BrandFont } from './types';

const loaded = new Map<string, { key: string; face: FontFace }>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const FONT_EXT = /\.(otf|ttf|woff2?)$/i;
export const isFontFile = (f: { name?: string; type?: string; mime?: string }) =>
  (f.type ?? f.mime ?? '').startsWith('font/') || /font|opentype|truetype/.test(f.type ?? f.mime ?? '') || FONT_EXT.test(f.name ?? '');

async function register(font: BrandFont, asset: Asset) {
  if (!asset.blobKey) return;
  const key = `${font.family}:${asset.blobKey}`;
  if (loaded.get(font.family)?.key === key) return;
  const blob = await localFiles.get(asset.blobKey);
  if (!blob) return;
  try {
    const face = new FontFace(font.family, await blob.arrayBuffer());
    await face.load();
    const prev = loaded.get(font.family);
    if (prev) document.fonts.delete(prev.face);
    document.fonts.add(face);
    loaded.set(font.family, { key, face });
    notify();
  } catch (e) {
    console.warn(`[creator-os] could not load font “${font.name}”`, e);
  }
}

/** Keeps document.fonts in sync with the Brand Kit. Mount once at the app root. */
export function useBrandFontRegistry() {
  const fonts = useStore((s) => s.brandFonts);
  const assets = useStore((s) => s.assets);
  useEffect(() => {
    const families = new Set(fonts.map((f) => f.family));
    for (const [family, entry] of loaded) {
      if (!families.has(family)) {
        document.fonts.delete(entry.face);
        loaded.delete(family);
      }
    }
    for (const f of fonts) {
      const a = f.assetId ? assets.find((x) => x.id === f.assetId) : undefined;
      if (a) void register(f, a);
    }
  }, [fonts, assets]);
}

/** Re-render when a brand font finishes loading. */
export function useFontsVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const l = () => setV((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return v;
}

/** CSS font-family for a brand font, with a sensible fallback. */
export const fontStack = (f?: BrandFont) =>
  f ? `"${f.family}", ${f.role === 'text' ? 'var(--font-ui)' : 'system-ui'}, sans-serif` : 'var(--font-ui)';

/** Load an arbitrary font file for a one-off preview (Asset Library). */
export async function previewFamily(asset: Asset): Promise<string | null> {
  if (!asset.blobKey) return null;
  const family = `preview-${asset.id.slice(0, 8)}`;
  if ([...document.fonts].some((f) => f.family === family)) return family;
  const blob = await localFiles.get(asset.blobKey);
  if (!blob) return null;
  try {
    const face = new FontFace(family, await blob.arrayBuffer());
    await face.load();
    document.fonts.add(face);
    return family;
  } catch {
    return null;
  }
}
