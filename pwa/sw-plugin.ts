/* Vite plugin: emits /sw.js at build time with a precache list of exactly this build's files. */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

// Public files the installed app needs offline. Large or rarely-used files are fetched on demand instead.
const PUBLIC_INCLUDE = [/^fonts\//, /^icons\/(icon|maskable|apple-touch|favicon|badge)/, /^brand\/kroopy-(logo|symbol)\.png$/, /^manifest\.webmanifest$/, /^favicon\.ico$/];

function walk(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, root) : [relative(root, full).split(sep).join('/')];
  });
}

export function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'kroopy-service-worker',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const fromPublic = walk(publicDir).filter((f) => PUBLIC_INCLUDE.some((re) => re.test(f)));
      const files = Array.from(new Set(['index.html', ...built, ...fromPublic])).map((f) => `/${f}`);
      const version = createHash('sha256').update(files.sort().join('|')).update(String(Date.now())).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files, null, 2)),
      });
    },
  };
}
