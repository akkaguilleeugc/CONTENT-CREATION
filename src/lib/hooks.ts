import { useEffect, useMemo, useRef, useState } from 'react';
import { cachedFileUrl, fileUrl } from './persistence';
import { useStore } from './store';
import type { Asset } from './types';

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');

/** Re-renders every `ms` so time-based UI (greeting, overdue states) stays current. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Resolve a displayable URL for an asset (static file or IndexedDB blob). */
export function useAssetUrl(asset?: Asset | null): string | null {
  const key = asset?.blobKey;
  const [url, setUrl] = useState<string | null>(() => asset?.src ?? cachedFileUrl(key));
  useEffect(() => {
    let alive = true;
    if (asset?.src) {
      setUrl(asset.src);
      return;
    }
    if (!key) {
      setUrl(null);
      return;
    }
    const cached = cachedFileUrl(key);
    if (cached) {
      setUrl(cached);
      return;
    }
    fileUrl(key).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [asset?.src, key]);
  return url;
}

export function useAsset(id?: string) {
  return useStore((s) => (id ? s.assets.find((a) => a.id === id) : undefined));
}

export function usePlatforms() {
  const platforms = useStore((s) => s.settings.platforms);
  return useMemo(() => {
    const map = new Map(platforms.map((p) => [p.id, p]));
    return { list: platforms, get: (id: string) => map.get(id) };
  }, [platforms]);
}

/** Debounced autosave helper: returns a setter that commits after `ms` of quiet. */
export function useDebouncedCommit<T>(commit: (v: T) => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<T | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (latest.current !== null) commitRef.current(latest.current);
      }
    },
    [],
  );
  return (v: T) => {
    latest.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current(v);
      latest.current = null;
    }, ms);
  };
}

/** Pointer-follow spotlight for `.spotlight` panels. */
export function spotlightHandlers() {
  return {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
  };
}
