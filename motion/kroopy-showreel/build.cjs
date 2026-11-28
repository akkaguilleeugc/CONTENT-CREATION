/* Inlines Inter, KROOPY's white wordmark and the app's Lucide icons into one self-contained HTML file. */
const fs = require('fs');
const path = require('path');
const here = __dirname, root = path.join(here, '..', '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const out = fs.readFileSync(path.join(here, 'src.html'), 'utf8')
  .replace('__INTER_B64__', b64(path.join(root, 'public', 'landing', 'inter.woff2')))
  .replace('__WM_B64__', b64(path.join(root, 'public', 'brand', 'kroopy-logo-white.png')))
  .replace('__ICONS_JSON__', fs.readFileSync(path.join(here, 'icons.json'), 'utf8'));
fs.writeFileSync(path.join(here, 'kroopy-showreel.html'), out);
console.log('kroopy-showreel.html', (out.length / 1024).toFixed(0) + ' KB');
