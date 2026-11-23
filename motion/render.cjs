/*
 * Renders motion/viralgrow-15s.html frame by frame and encodes the final MP4.
 *
 *   python3 motion/soundtrack.py motion/out/soundtrack.wav
 *   node motion/render.cjs            # → motion/out/viralgrow-15s.mp4
 *
 * Requires Playwright (Chromium) and ffmpeg with libx264.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const FPS = 60;
const DURATION = 15;
const SILENT = path.join(OUT, 'viralgrow-15s.silent.mp4');
const FINAL = path.join(OUT, 'viralgrow-15s.mp4');
const AUDIO = path.join(OUT, 'soundtrack.wav');

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'inherit'] });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    if (input) input(p.stdin);
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  await page.goto('file://' + path.join(ROOT, 'viralgrow-15s.html') + '?render=1');
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(400);
  const stage = page.locator('#stage');

  const total = FPS * DURATION;
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', SILENT], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    const buf = await stage.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`frame ${f}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await done;
  await browser.close();

  if (fs.existsSync(AUDIO)) {
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', SILENT, '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
      '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', FINAL]);
    fs.unlinkSync(SILENT);
  } else {
    fs.renameSync(SILENT, FINAL);
  }
  console.log('done →', FINAL, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
