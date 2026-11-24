/*
 * Generates every home-screen / PWA asset for KROOPY from the original, untouched logo files.
 *
 *   node scripts/generate-pwa-assets.cjs                 # icons, favicons, launch screens, shortcut icons
 *   node scripts/generate-pwa-assets.cjs --screenshots   # + store screenshots (needs `npm run dev` running)
 *
 * The black symbol (public/brand/original/2.png) is always presented on the brand lime plate —
 * never recoloured or redrawn. The Android notification badge is the only exception: Android
 * renders it as a white silhouette, so it is derived from the logo's alpha channel (same shape).
 * Requires Playwright (Chromium).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const L = require('lucide-react');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'icons');
const SPLASH = path.join(ROOT, 'public', 'splash');
// Embedded as a data URL: pages created with setContent cannot load file:// images.
const SYMBOL = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public', 'brand', 'original', '2.png')).toString('base64');
const LIME = '#D4F53C';
const INK = '#0B0F14';

// Alpha bounding box of the symbol inside the 6250×6250 original (measured once with PIL).
const BOX = { x: 1132, y: 1599, w: 3983, h: 2807, full: 6250 };

/** CSS that crops the original PNG to its artwork and scales it to `width` px, centred. */
const symbolCss = (width, extra = '') => {
  const scale = width / BOX.w;
  return `position:absolute;left:50%;top:50%;width:${BOX.full * scale}px;height:${BOX.full * scale}px;
    margin-left:${-(BOX.x + BOX.w / 2) * scale}px;margin-top:${-(BOX.y + BOX.h / 2) * scale}px;${extra}`;
};

const page = (body, bg = 'transparent') => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:${bg};overflow:hidden}
  .wrap{position:relative;width:100vw;height:100vh;overflow:hidden}
</style></head><body><div class="wrap">${body}</div></body></html>`;

/** Lime plate with the symbol. `ratio` = symbol width / canvas; `radius` in % (0 = full bleed). */
const iconHtml = (size, ratio, radius = 0, glossy = true) =>
  page(`<div style="position:absolute;inset:0;border-radius:${radius}%;overflow:hidden;background:${LIME};
      ${glossy ? `background-image:radial-gradient(120% 90% at 22% 8%, rgba(255,255,255,.34), transparent 55%), radial-gradient(90% 80% at 85% 100%, rgba(140,180,0,.22), transparent 60%);` : ''}">
      <img src="${SYMBOL}" style="${symbolCss(size * ratio)}">
    </div>`);

const badgeHtml = (size) =>
  // White silhouette from the logo's alpha (Android notification badge requirement).
  page(`<img src="${SYMBOL}" style="${symbolCss(size * 0.84, 'filter:brightness(0) invert(1);')}">`);

const shortcutHtml = (size, icon) =>
  page(`<div style="position:absolute;inset:0;border-radius:24%;background:${LIME};
      background-image:radial-gradient(120% 90% at 22% 8%, rgba(255,255,255,.34), transparent 55%);
      display:grid;place-items:center">${renderToStaticMarkup(React.createElement(L[icon], { size: size * 0.5, color: INK, strokeWidth: 2.2 }))}</div>`);

/** Branded iOS launch screen: Ink with the app's royal/lime glow and the icon centred. */
const splashHtml = (w, h) => {
  const icon = Math.round(Math.min(w, h) * 0.26);
  return page(
    `<div style="position:absolute;inset:0;background:
        radial-gradient(70% 45% at 88% 0%, rgba(47,91,255,.42), transparent 62%),
        radial-gradient(60% 40% at 0% 100%, rgba(212,245,60,.14), transparent 60%),
        radial-gradient(80% 50% at 50% 120%, rgba(11,26,92,.9), transparent 70%), ${INK}"></div>
     <div style="position:absolute;left:50%;top:50%;width:${icon}px;height:${icon}px;margin:${-icon / 2}px 0 0 ${-icon / 2}px;
        border-radius:23%;background:${LIME};overflow:hidden;
        background-image:radial-gradient(120% 90% at 22% 8%, rgba(255,255,255,.34), transparent 55%);
        box-shadow:0 ${icon * 0.12}px ${icon * 0.4}px -${icon * 0.1}px rgba(212,245,60,.45), inset 0 1px 0 rgba(255,255,255,.5)">
       <img src="${SYMBOL}" style="${symbolCss(icon * 0.64)}">
     </div>`,
    INK,
  );
};

// iOS launch screens: [CSS width, CSS height, device pixel ratio]
const DEVICES = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3],
  [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [768, 1024, 2],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SPLASH, { recursive: true });
  const browser = await chromium.launch();
  const shot = async (html, w, h, file, transparent = true) => {
    const p = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((r) => (i.onload = r))))));
    await p.screenshot({ path: file, omitBackground: transparent });
    await p.context().close();
  };

  // App icons (square, full bleed — the OS applies its own mask/rounding)
  for (const s of [512, 192]) await shot(iconHtml(s, 0.62), s, s, path.join(OUT, `icon-${s}.png`), false);
  // Maskable: artwork inside the 80 % safe circle
  for (const s of [512, 192]) await shot(iconHtml(s, 0.5), s, s, path.join(OUT, `maskable-${s}.png`), false);
  // Apple touch icon (iOS rounds it; no transparency allowed)
  await shot(iconHtml(180, 0.62), 180, 180, path.join(OUT, 'apple-touch-icon.png'), false);
  // Favicons: rounded plate so they read well in tabs
  for (const s of [48, 32, 16]) await shot(iconHtml(s, 0.74, 24, s >= 32), s, s, path.join(OUT, `favicon-${s}.png`));
  // Android notification badge
  await shot(badgeHtml(96), 96, 96, path.join(OUT, 'badge-96.png'));
  // Shortcut icons (long-press on the home-screen icon)
  for (const [name, icon] of [['idea', 'Lightbulb'], ['video', 'Clapperboard'], ['task', 'ListPlus'], ['calendar', 'CalendarDays']])
    await shot(shortcutHtml(192, icon), 192, 192, path.join(OUT, `shortcut-${name}.png`));
  // iOS launch screens
  for (const [w, h, r] of DEVICES) {
    const p = await (await browser.newContext({ viewport: { width: w * r, height: h * r }, deviceScaleFactor: 1 })).newPage();
    await p.setContent(splashHtml(w * r, h * r), { waitUntil: 'load' });
    // JPEG keeps the gradient launch screens small (~30 KB instead of ~800 KB as PNG).
    await p.screenshot({ path: path.join(SPLASH, `launch-${w * r}x${h * r}.jpg`), type: 'jpeg', quality: 88 });
    await p.context().close();
  }

  if (process.argv.includes('--screenshots')) {
    const base = process.env.BASE || 'http://127.0.0.1:5173';
    for (const [name, opts] of [
      ['narrow', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
      ['wide', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
    ]) {
      const p = await (await browser.newContext(opts)).newPage();
      await p.goto(base + '/');
      await p.waitForTimeout(700);
      await p.getByRole('button', { name: 'Explore with sample data' }).click();
      await p.waitForTimeout(4300); // let the welcome toast leave
      await p.screenshot({ path: path.join(OUT, `screenshot-${name}.jpg`), type: 'jpeg', quality: 86 });
      await p.context().close();
    }
  }
  await browser.close();
  console.log('PWA assets written to public/icons and public/splash');
})();
