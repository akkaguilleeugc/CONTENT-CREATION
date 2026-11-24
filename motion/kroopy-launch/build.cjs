/* Inlines the brand font, the OO mark and the app's Lucide icons into one self-contained HTML file. */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const root = path.join(here, '..', '..');
const src = fs.readFileSync(path.join(here, 'src.html'), 'utf8');
const font = fs.readFileSync(path.join(root, 'public', 'fonts', 'Coolvetica-Regular.otf')).toString('base64');
const oo = fs.readFileSync(path.join(here, 'oo.png')).toString('base64');
const icons = fs.readFileSync(path.join(here, 'icons.json'), 'utf8');

const out = src.replace('__FONT_B64__', font).replace('__OO_B64__', oo).replace('__ICONS_JSON__', icons);
fs.writeFileSync(path.join(here, 'kroopy-launch.html'), out);
console.log('kroopy-launch.html', (out.length / 1024).toFixed(0) + ' KB');
