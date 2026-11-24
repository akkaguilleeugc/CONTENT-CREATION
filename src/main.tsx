import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initPWA } from './lib/pwa';
import { initStore, useStore } from './lib/store';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/pages.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initPWA();

initStore().catch((e) => {
  console.error('[creator-os] failed to load data', e);
  // Never leave the user on the boot screen: open with an empty workspace instead.
  useStore.setState({ hydrated: true, saveState: 'error' });
});
