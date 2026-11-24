/* Installed-app (PWA) integration: service worker, install prompt, badge, notifications, haptics. */
import { create } from 'zustand';
import { toast } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/.test(ua);
export const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(ua);

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

interface PwaState {
  standalone: boolean;
  installEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  registration: ServiceWorkerRegistration | null;
  updateReady: boolean;
}

export const usePWA = create<PwaState>()(() => ({
  standalone: isStandalone(),
  installEvent: null,
  installed: isStandalone(),
  registration: null,
  updateReady: false,
}));

/** Android / desktop Chrome: show the native install dialog. */
export async function promptInstall(): Promise<boolean> {
  const ev = usePWA.getState().installEvent;
  if (!ev) return false;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  usePWA.setState({ installEvent: null });
  return outcome === 'accepted';
}

let updateRequested = false;
function applyUpdate() {
  const waiting = usePWA.getState().registration?.waiting;
  if (!waiting) return;
  updateRequested = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function initPWA() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePWA.setState({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    usePWA.setState({ installed: true, installEvent: null });
    toast('KROOPY installed', { description: 'Open it from your home screen.' });
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
    usePWA.setState({ standalone: e.matches });
    document.documentElement.classList.toggle('standalone', e.matches);
  });

  // The service worker only runs in production builds (dev keeps hot reload uncached).
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload when the user tapped “Update” — not when the very first service worker takes control.
    if (reloading || !updateRequested) return;
    reloading = true;
    window.location.reload();
  });
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      usePWA.setState({ registration: reg });
      const offerUpdate = () => {
        usePWA.setState({ updateReady: true });
        toast('A new version of KROOPY is ready', { tone: 'info', description: 'Update now — your data stays on this device.', action: { label: 'Update', run: applyUpdate } });
      };
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate();
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
        });
      });
      // Look for a new version whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
    } catch (e) {
      console.warn('[kroopy] service worker registration failed', e);
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}

export { applyUpdate };

/** Home-screen icon badge (iOS 16.4+ home-screen apps, Android, desktop). */
export function setBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) void nav.setAppBadge?.(count)?.catch(() => {});
    else void nav.clearAppBadge?.()?.catch(() => {});
  } catch {
    /* unsupported */
  }
}

/** System notification — through the service worker when available (required on Android). */
export async function systemNotify(title: string, body: string, url = '/', tag?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: tag ?? title, data: { url } };
  try {
    const reg = usePWA.getState().registration ?? (await navigator.serviceWorker?.getRegistration?.());
    if (reg) return void (await reg.showNotification(title, options));
    new Notification(title, options);
  } catch {
    /* some browsers block notifications from the page context */
  }
}

/** A tiny tap of haptic feedback where supported (Android). */
export const haptic = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
};
