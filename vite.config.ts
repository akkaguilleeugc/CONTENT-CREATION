import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { serviceWorker } from './pwa/sw-plugin';

/** Serve the static landing page (public/landing/index.html) at /landing in dev and preview. */
function landingRoute(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url === '/landing' || req.url === '/landing/' || req.url?.startsWith('/landing/?')) req.url = '/landing/index.html';
    next();
  };
  return {
    name: 'landing-route',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

export default defineConfig({
  plugins: [react(), landingRoute(), serviceWorker()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Local development with the cloud functions: run `netlify dev` (port 8888) and start Vite with
  // KROOPY_API_PROXY=http://localhost:8888 so /api reaches them.
  server: process.env.KROOPY_API_PROXY ? { proxy: { '/api': { target: process.env.KROOPY_API_PROXY, changeOrigin: true } } } : undefined,
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
