/* Inlines Coolvetica, 212 Baby Girl, Inter, the OO mark, the wordmark and the app's Lucide icons into one HTML file. */
const fs = require('fs');
const path = require('path');
const here = __dirname, root = path.join(here, '..', '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const out = fs.readFileSync(path.join(here, 'src.html'), 'utf8')
  .replace('__COOL_B64__', b64(path.join(root, 'public', 'fonts', 'Coolvetica-Regular.otf')))
  .replace('__BABY_B64__', b64(path.join(root, 'public', 'fonts', '212-Baby-Girl.otf')))
  .replace('__INTER_B64__', b64(path.join(root, 'public', 'landing', 'inter.woff2')))
  .replace('__OO_B64__', b64(path.join(here, 'oo.png')))
  .replace('__WM_B64__', b64(path.join(here, 'wordmark.png')))
  .replace('__ICONS_JSON__', fs.readFileSync(path.join(here, 'icons.json'), 'utf8'));
fs.writeFileSync(path.join(here, 'kroopy-devices.html'), out);
console.log('kroopy-devices.html', (out.length / 1024).toFixed(0) + ' KB');
