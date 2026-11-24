/* ──────────────────────────────────────────────────────────────
   Languages: English (source), Español, Português (Brasil).

   Every user-facing string goes through $t('English text'). The
   dictionaries in src/i18n/*.json map the English text to the
   translation; anything missing falls back to English. Values can use
   {placeholders}: $t('{n} open', { n: 3 }).

   The language is read once at start-up (saved choice, else the
   device language). Changing it saves the choice and reloads, so
   every label — including module-level constants and date formats —
   is rebuilt in the new language.
   ────────────────────────────────────────────────────────────── */
import { setDefaultOptions } from 'date-fns';
import { es, ptBR } from 'date-fns/locale';

export type Lang = 'en' | 'es' | 'pt-BR';
export const LANGS: { id: Lang; label: string; short: string; flag: string }[] = [
  { id: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { id: 'es', label: 'Español', short: 'ES', flag: '🇪🇸' },
  { id: 'pt-BR', label: 'Português (Brasil)', short: 'PT', flag: '🇧🇷' },
];
const KEY = 'kroopy:lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'es' || saved === 'pt-BR') return saved;
  } catch {
    /* storage blocked */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.languages?.[0] || navigator.language : 'en').toLowerCase();
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('pt')) return 'pt-BR';
  return 'en';
}

export const LANG: Lang = detect();

/* Only the active dictionary is downloaded (top-level await keeps every importer in sync). */
const DICT: Record<string, string> | null =
  LANG === 'es' ? (await import('@/i18n/es.json')).default : LANG === 'pt-BR' ? (await import('@/i18n/pt-BR.json')).default : null;

if (LANG !== 'en') setDefaultOptions({ locale: LANG === 'es' ? es : ptBR });
if (typeof document !== 'undefined') document.documentElement.lang = LANG;

/** Translate an English UI string. */
export function $t(text: string, vars?: Record<string, string | number>): string {
  let out = (DICT && DICT[text]) || text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return out;
}

/** Switch language: saved on this device (and in synced settings), then the app reloads in it. */
export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/** Locale tag for Intl APIs (numbers, relative times). */
export const LOCALE = LANG === 'pt-BR' ? 'pt-BR' : LANG === 'es' ? 'es-ES' : 'en-GB';
