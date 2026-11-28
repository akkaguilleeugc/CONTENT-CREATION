// Renders the app's own Lucide icons to static SVG strings for the showreel (vector, recolourable).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L from 'lucide-react';
import fs from 'fs';
const names = ['Plus', 'Lightbulb', 'Clapperboard', 'ListPlus', 'CalendarPlus', 'Star', 'Check', 'Search', 'CalendarDays', 'ArrowUp', 'Sparkles', 'X', 'Ellipsis', 'Brain', 'GripVertical', 'Bell', 'Menu', 'House', 'ListChecks', 'Clock'];
const out = {};
for (const n of names) out[n] = renderToStaticMarkup(createElement(L[n], { size: 24, strokeWidth: 2 }));
fs.writeFileSync(new URL('./icons.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length, 'icons');
