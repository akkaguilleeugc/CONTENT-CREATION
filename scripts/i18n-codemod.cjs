/* i18n codemod: wraps user-facing English strings in $t('…') and collects them.
   node scripts/i18n-codemod.cjs --dry   → list strings only
   node scripts/i18n-codemod.cjs         → rewrite files in place + write src/i18n/strings.json */
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..', 'src');
const DRY = process.argv.includes('--dry');
const SKIP = new Set(['lib/sample.ts', 'lib/i18n.ts', 'lib/types.ts', 'main.tsx']);
const ATTRS = new Set(['label', 'placeholder', 'title', 'aria-label', 'description', 'hint', 'tip', 'text', 'sub', 'alt', 'data-tip', 'subtitle', 'caption', 'emptyText', 'emptyTitle', 'heading', 'cta', 'confirmLabel', 'cancelLabel', 'actionLabel', 'kicker', 'eyebrow', 'note', 'help', 'unit']);
const KEYS = new Set(['label', 'title', 'description', 'hint', 'sub', 'text', 'placeholder', 'tip', 'short', 'desc', 'caption', 'subtitle', 'heading', 'message', 'confirmLabel', 'cancelLabel', 'cta', 'empty', 'help', 'helper', 'aria', 'unitLabel', 'blurb', 'detail', 'question', 'answer', 'name']);
const CALLS = new Set(['toast', 'alert']);
const hasWords = (s) => /[A-Za-z]{2,}/.test(s) && !/^[a-z0-9_.:/#-]+$/.test(s) && !/^(https?:|\/|#|var\(|rgba?\(|[a-z]+-[a-z-]+$)/.test(s);

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|ts)$/.test(f)) files.push(p); } })(ROOT);

const all = new Map();
let total = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP.has(rel) || rel.startsWith('i18n/')) continue;
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] }); } catch (e) { console.error('parse fail', rel, e.message); continue; }
  const edits = [];
  const add = (s) => { all.set(s, (all.get(s) || 0) + 1); };
  const ok = (p) => {
    // climb through conditionals / logicals / parens
    let c = p;
    while (c.parentPath && (c.parentPath.isConditionalExpression() && c.key !== 'test' || c.parentPath.isLogicalExpression() && c.key === 'right' || c.parentPath.isTSAsExpression() || c.parentPath.isParenthesizedExpression())) c = c.parentPath;
    const par = c.parentPath;
    if (!par) return false;
    if (par.isJSXExpressionContainer()) {
      const gp = par.parentPath;
      if (gp.isJSXAttribute()) return ATTRS.has(gp.node.name.name);
      return true; // child
    }
    if (par.isJSXAttribute()) return ATTRS.has(par.node.name.name) && c.key === 'value';
    if (par.isObjectProperty() && c.key === 'value') {
      const k = par.node.key.name || par.node.key.value;
      return KEYS.has(k);
    }
    if (par.isCallExpression() && c.listKey === 'arguments' && c.key === 0) {
      const callee = par.node.callee;
      return callee.type === 'Identifier' && CALLS.has(callee.name);
    }
    return false;
  };
  traverse(ast, {
    JSXText(p) {
      const raw = p.node.value;
      const s = raw.replace(/\s+/g, ' ').trim();
      if (!hasWords(s)) return;
      const lead = raw.match(/^\s*/)[0].length, trail = raw.match(/\s*$/)[0].length;
      const start = p.node.start + lead, end = p.node.end - trail;
      // keep a single leading/trailing space when the original had inline (non-newline) whitespace
      edits.push({ start, end, text: `{$t(${JSON.stringify(s)})}` });
      add(s);
    },
    StringLiteral(p) {
      const s = p.node.value;
      if (!hasWords(s) || !ok(p)) return;
      if (p.parentPath.isImportDeclaration() || p.parentPath.isExportNamedDeclaration()) return;
      const inAttr = p.parentPath.isJSXAttribute();
      edits.push({ start: p.node.start, end: p.node.end, text: inAttr ? `{$t(${JSON.stringify(s)})}` : `$t(${JSON.stringify(s)})` });
      add(s);
    },
  });
  if (!edits.length) continue;
  total += edits.length;
  if (DRY) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = code;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (!/from '@\/lib\/i18n'/.test(out)) {
    // insert after the last import
    const m = [...out.matchAll(/^import[^;]+;\s*$/gm)];
    const at = m.length ? m[m.length - 1].index + m[m.length - 1][0].length : 0;
    out = out.slice(0, at) + `\nimport { $t } from '@/lib/i18n';` + out.slice(at);
  }
  fs.writeFileSync(file, out);
}
const list = [...all.keys()].sort();
if (!DRY) { fs.mkdirSync(path.join(ROOT, 'i18n'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'i18n', 'strings.json'), JSON.stringify(list, null, 1)); }
console.log('edits', total, 'unique strings', list.length);
if (DRY) console.log(list.join('\n'));
