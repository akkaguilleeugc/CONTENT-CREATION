/* Builds src/i18n/es.json and src/i18n/pt-BR.json from scripts/i18n/*.tsv (index → ES → PT) and
   src/i18n/strings.json (index → English). Fails if a line is missing or a {placeholder} is lost. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/strings.json'), 'utf8'));
const es = {}, pt = {};
const seen = new Set();
let problems = 0;
for (const f of fs.readdirSync(path.join(__dirname, 'i18n')).filter((x) => x.endsWith('.tsv')).sort()) {
  for (const line of fs.readFileSync(path.join(__dirname, 'i18n', f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const [idx, e, p] = line.split('\t');
    const i = Number(idx);
    const en = strings[i];
    if (en === undefined || e === undefined || p === undefined) { console.error('bad line', f, line.slice(0, 80)); problems++; continue; }
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    if (ph(en) !== ph(e) || ph(en) !== ph(p)) { console.error('placeholder mismatch', i, en, '|', e, '|', p); problems++; }
    es[en] = e; pt[en] = p; seen.add(i);
  }
}
const missing = strings.map((s, i) => (seen.has(i) ? null : `${i}|${s}`)).filter(Boolean);
if (missing.length) { console.error('missing translations:\n' + missing.join('\n')); problems += missing.length; }
fs.writeFileSync(path.join(ROOT, 'src/i18n/es.json'), JSON.stringify(es, null, 1));
fs.writeFileSync(path.join(ROOT, 'src/i18n/pt-BR.json'), JSON.stringify(pt, null, 1));
console.log(`es ${Object.keys(es).length} · pt-BR ${Object.keys(pt).length} · problems ${problems}`);
process.exit(problems ? 1 : 0);
