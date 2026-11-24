/* ──────────────────────────────────────────────────────────────
   Push notifications — reminders on your phone and computer, even
   when KROOPY is closed.

   1. On a device, “Turn on” asks for permission and registers that
      device with your account (Web Push, standard VAPID keys).
   2. Every signed-in device keeps the cloud's list of upcoming
      reminders (next 14 days) in step with your data.
   3. The cloud checks every 2 minutes and sends what's due.

   iPhone / iPad: needs iOS 16.4+ and KROOPY added to the Home Screen
   (Safari → Share → Add to Home Screen), then turned on from there.
   ────────────────────────────────────────────────────────────── */
import { create } from 'zustand';
import { planReminders } from '@/features/reminders';
import type { PushApi } from './cloud/backend';
import { $t } from './i18n';
import { isIOS, isStandalone, usePWA } from './pwa';
import { useStore } from './store';
import { backend, DEVICE, useSync } from './sync';

export type PushSupport = 'ok' | 'needs-install' | 'unsupported';

interface PushState {
  support: PushSupport;
  permission: NotificationPermission | 'unsupported';
  /** this device receives push notifications */
  enabled: boolean;
  busy: boolean;
  /** the cloud behind this site can send them */
  available: boolean;
}

const LS_ON = 'kroopy:push-on';
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

function detectSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || typeof Notification === 'undefined') return isIOS && !isStandalone() ? 'needs-install' : 'unsupported';
  if (!('PushManager' in window)) return isIOS && !isStandalone() ? 'needs-install' : 'unsupported';
  return 'ok';
}

export const usePush = create<PushState>(() => ({
  support: detectSupport(),
  permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  enabled: lsGet(LS_ON) === '1',
  busy: false,
  available: false,
}));

async function api(): Promise<PushApi | null> {
  const be = await backend();
  return be?.notifications ?? null;
}

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  const reg = usePWA.getState().registration ?? (await navigator.serviceWorker.getRegistration());
  if (reg) return reg;
  return navigator.serviceWorker.ready;
}

/** Turn push notifications on for this device. Must run from a tap (iOS asks for permission only then). */
export async function enablePush(): Promise<'ok' | 'denied' | 'signin' | 'unsupported' | 'error'> {
  const st = usePush.getState();
  if (st.support !== 'ok') return 'unsupported';
  const push = await api();
  if (!push) return 'unsupported';
  if (!useSync.getState().user) return 'signin';
  usePush.setState({ busy: true });
  try {
    const permission = await Notification.requestPermission();
    usePush.setState({ permission });
    if (permission !== 'granted') return 'denied';
    const reg = await registration();
    const key = await push.publicKey();
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options?.applicationServerKey) {
      // A subscription made for other keys can't receive our messages: replace it.
      const current = new Uint8Array(sub.options.applicationServerKey);
      const want = keyBytes(key);
      if (current.length !== want.length || current.some((b, i) => b !== want[i])) {
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    await push.subscribe(sub.toJSON(), DEVICE);
    lsSet(LS_ON, '1');
    usePush.setState({ enabled: true });
    useStore.getState().setSettings({ notifications: true });
    lastHash = ''; // make sure the cloud has the current reminders
    await uploadSchedule();
    return 'ok';
  } catch (e) {
    console.warn('[kroopy] push enable failed', e);
    return 'error';
  } finally {
    usePush.setState({ busy: false });
  }
}

export async function disablePush() {
  usePush.setState({ busy: true });
  try {
    const reg = await registration().catch(() => null);
    const sub = await reg?.pushManager.getSubscription();
    const push = await api();
    if (push && useSync.getState().user) await push.unsubscribe(sub?.endpoint ?? null, DEVICE).catch(() => undefined);
    await sub?.unsubscribe().catch(() => undefined);
  } finally {
    lsSet(LS_ON, null);
    usePush.setState({ enabled: false, busy: false });
  }
}

/** Sends a test notification to this device through the cloud (proves the whole path works). */
export async function testPush() {
  const push = await api();
  if (!push) return 0;
  const res = await push.test(DEVICE, $t('KROOPY notifications are on'), $t('Reminders for tasks, events, habits and posts will arrive here, even with KROOPY closed.'));
  return res.sent;
}

/* ── keep the cloud's reminder list in step ── */
const HORIZON = 14 * 86_400_000;
let lastHash = '';
let uploading = false;
async function uploadSchedule() {
  const push = await api();
  const user = useSync.getState().user;
  if (!push || !user || uploading || !navigator.onLine) return;
  const s = useStore.getState();
  if (!s.hydrated) return;
  const now = Date.now();
  const items = planReminders(s, now - 60_000, now + HORIZON).slice(0, 380);
  const hash = `${user.id}|${items.map((i) => `${i.key}@${i.at}|${i.title}|${i.body}`).join(';')}`;
  if (hash === lastHash) return;
  uploading = true;
  try {
    await push.schedule(items);
    lastHash = hash;
  } catch (e) {
    console.warn('[kroopy] reminder upload failed', e);
  } finally {
    uploading = false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
const soon = (ms = 2500) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void uploadSchedule(), ms);
};

/** Starts the reminder hand-off; call once after the app has loaded. */
export function initPush() {
  void (async () => {
    const push = await api();
    if (!push) return;
    const unconfigured = () => useSync.getState().status === 'unconfigured';
    usePush.setState({ available: !unconfigured() });
    useSync.subscribe((st, prev) => {
      if (st.status !== prev.status) usePush.setState({ available: st.status !== 'unconfigured' });
      if (st.user?.id !== prev.user?.id) {
        lastHash = '';
        if (st.user) {
          void reRegister();
          soon(1500);
        }
      }
    });
    useStore.subscribe((s, prev) => {
      if (s.rev !== prev.rev && useSync.getState().user) soon();
    });
    // The 14-day window moves on with time; refresh it every hour while KROOPY is open.
    setInterval(() => soon(0), 60 * 60_000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && soon(1500));
    if (useSync.getState().user) {
      void reRegister();
      soon(3000);
    }
  })();
}

/** Re-sends this device's subscription (it can change, e.g. after the browser refreshes it). */
async function reRegister() {
  const st = usePush.getState();
  if (!st.enabled || st.support !== 'ok' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const push = await api();
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (push && sub) await push.subscribe(sub.toJSON(), DEVICE);
    else if (push && !sub) {
      // The browser dropped it: subscribe again silently (permission is still granted).
      const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(await push.publicKey()) });
      await push.subscribe(fresh.toJSON(), DEVICE);
    }
  } catch (e) {
    console.warn('[kroopy] push re-register failed', e);
  }
}
