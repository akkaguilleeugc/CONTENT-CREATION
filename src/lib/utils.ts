import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from 'date-fns';
import type { DateStr, TimeStr } from './types';

export { clsx as cn } from 'clsx';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const nowISO = () => new Date().toISOString();

/* ── Dates (all date-only values are local calendar dates) ── */
export const toDateStr = (d: Date): DateStr => format(d, 'yyyy-MM-dd');
export const todayStr = (): DateStr => toDateStr(new Date());
export const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};
/** Combine a local date and optional time into a Date in the local timezone. */
export const dateTime = (date?: DateStr, time?: TimeStr): Date | null => {
  const d = parseDate(date);
  if (!d) return null;
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d;
};
export const daysFromToday = (s?: DateStr): number | null => {
  const d = parseDate(s);
  return d ? differenceInCalendarDays(d, new Date()) : null;
};

export function relativeDay(s?: DateStr): string {
  const diff = daysFromToday(s);
  if (diff === null) return '';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return format(parseDate(s)!, 'EEEE');
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  const d = parseDate(s)!;
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'd MMM' : 'd MMM yyyy');
}

export const fmtDate = (s?: string, pattern = 'd MMM yyyy') => {
  const d = parseDate(s);
  return d ? format(d, pattern) : '';
};

export const fmtTime = (t?: TimeStr) => t ?? '';

export const weekStart = (d: Date, weekStartsOn: 0 | 1) => startOfWeek(d, { weekStartsOn });
export const rangeDays = (start: Date, count: number) =>
  Array.from({ length: count }, (_, i) => addDays(start, i));

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 19) return 'Good afternoon';
  return 'Good evening';
}

/* ── Numbers ── */
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const pct = (num: number, den: number) => (den > 0 ? clamp((num / den) * 100, 0, 100) : 0);

export function compact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${+(n / 1e3).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export const fmtNumber = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

export function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${+(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function fmtDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m ? `${m}:${String(s).padStart(2, '0')} min` : `${s}s`;
}

export function fmtMinutes(min: number): string {
  if (!min) return '0h';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/* ── Strings ── */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || 'C';

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function matches(query: string, ...fields: (string | undefined | string[])[]) {
  const q = normalize(query.trim());
  if (!q) return true;
  return fields.some((f) => (Array.isArray(f) ? f.some((x) => normalize(x).includes(q)) : f && normalize(f).includes(q)));
}

/* ── Colour ── */
export const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
export function normalizeHex(s: string): string {
  let h = s.trim().replace(/^#?/, '#').toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(h)) h = '#' + h.slice(1).split('').map((c) => c + c).join('');
  return h;
}
function luminance(hex: string) {
  const h = normalizeHex(hex).slice(1);
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}
export function contrastRatio(a: string, b: string) {
  if (!isHex(a) || !isHex(b)) return 1;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}
export const readableOn = (hex: string) => (isHex(hex) && luminance(hex) > 0.4 ? '#0B0F14' : '#FFFFFF');
export function hexToRgb(hex: string) {
  const h = normalizeHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
}

/* ── Browser helpers ── */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export const isTypingTarget = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
