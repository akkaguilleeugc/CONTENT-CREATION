# Translations

The app is written in English; every visible string goes through `$t('…')` (`src/lib/i18n.ts`).

- `src/i18n/strings.json` — every English string, in a fixed order (append new ones at the end).
- `scripts/i18n/t*.tsv` — one line per string: `index<TAB>Español<TAB>Português (Brasil)`.
- `node scripts/i18n-build.cjs` — writes `src/i18n/es.json` and `src/i18n/pt-BR.json`, and fails if a
  line is missing or a `{placeholder}` was dropped.
- `node scripts/i18n-codemod.cjs` — wraps new hard-coded UI strings in `$t()` (run it after adding screens).

Legal texts (`src/pages/Legal.tsx`) are written per language and don't go through `$t`.
