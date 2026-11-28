/*
 * KROOPY showreel (60 s · 1080×1920 · 120 BPM) renderer.
 *
 *   node build.cjs                       # src.html → kroopy-showreel.html (self-contained)
 *   node render.cjs audio                # Web Audio (OfflineAudioContext) → out/kroopy-showreel-soundtrack.wav
 *   node render.cjs beats [dir]          # one still per beat (t = beat + 0.28 s) for review
 *   node render.cjs video [workers]      # 60 fps, 3 subframes per frame blended with tmix, then mux
 *
 * Requires Playwright (Chromium) and ffmpeg with libx264.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const HERE = __dirname;
const HTML = 'file://' + path.join(HERE, 'kroopy-showreel.html');
const OUT = path.join(HERE, '..', 'out');
const FPS = 60, SUB = 3, DUR = 60;
const WAV = path.join(OUT, 'kroopy-showreel-soundtrack.wav');
const FINAL = path.join(OUT, 'kroopy-showreel-60s.mp4');

async function openPage(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
  await page.goto(HTML);
  await page.evaluate(() => window.ready);
  return page;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });
}

async function audio() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser);
  const b64 = await page.evaluate(() => window.renderAudio());
  fs.writeFileSync(WAV, Buffer.from(b64, 'base64'));
  await browser.close();
  console.log('soundtrack →', WAV);
}

async function beats(dir, list) {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser);
  const cdp = await page.context().newCDPSession(page);
  const times = list || Array.from({ length: 120 }, (_, b) => [b, b * 0.5 + 0.28]);
  for (const [name, t] of times) {
    await page.evaluate((x) => window.seek(x), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(dir, `${String(name).padStart(3, '0')}.jpg`), Buffer.from(data, 'base64'));
  }
  await browser.close();
  console.log(times.length, 'stills →', dir);
}

/** Render frames [f0, f1) to an H.264 segment: SUB subframes per frame, averaged by tmix, every SUB-th kept. */
async function segment(browser, f0, f1, file, onFrame) {
  const page = await openPage(browser);
  const cdp = await page.context().newCDPSession(page);
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `tmix=frames=${SUB}:weights='1 1 1',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB)`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-tune', 'animation', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  for (let f = f0; f < f1; f++) {
    for (let k = 0; k < SUB; k++) {
      const t = (f * SUB + k) / (FPS * SUB);
      await page.evaluate((x) => window.seek(x), t);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
      if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    }
    onFrame();
  }
  ff.stdin.end();
  await done;
  await page.close();
}

async function video(workers = 4) {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(WAV)) await audio();
  const total = FPS * DUR;
  const per = Math.ceil(total / workers);
  const t0 = Date.now();
  let n = 0;
  const tick = () => { n++; if (n % 120 === 0) console.log(`frame ${n}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)}s`); };
  const parts = [];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const f0 = w * per, f1 = Math.min(total, f0 + per);
    const file = path.join(OUT, `kroopy-showreel-part${w}.mp4`);
    parts[w] = file;
    const browser = await chromium.launch();
    await segment(browser, f0, f1, file, tick);
    await browser.close();
  }));
  const list = path.join(OUT, 'kroopy-showreel-parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const silent = path.join(OUT, 'kroopy-showreel.silent.mp4');
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', WAV, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', String(DUR), '-movflags', '+faststart', FINAL]);
  parts.forEach((p) => fs.unlinkSync(p)); fs.unlinkSync(list); fs.unlinkSync(silent);
  console.log('done →', FINAL, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

(async () => {
  const [mode, arg] = process.argv.slice(2);
  if (mode === 'audio') await audio();
  else if (mode === 'beats') await beats(arg || path.join(OUT, 'beats'));
  else if (mode === 'times') await beats(arg, JSON.parse(process.argv[4]));
  else if (mode === 'video') await video(Number(arg) || 4);
  else console.log('usage: node render.cjs audio | beats [dir] | times dir "[[name,t],…]" | video [workers]');
})().catch((e) => { console.error(e); process.exit(1); });
