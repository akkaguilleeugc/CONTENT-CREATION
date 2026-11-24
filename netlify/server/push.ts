/* Web Push: VAPID keys (created once, kept in Blobs), each account's subscriptions and upcoming reminders. */
import { generateVAPIDKeys, sendNotification } from 'web-push';
import { configStore, getOrCreate, pushStore, updateJSON } from './store';

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device?: string;
  created: number;
}
export interface PushItem {
  key: string;
  /** when to deliver, epoch ms */
  at: number;
  title: string;
  body: string;
  url: string;
}
export interface PushRecord {
  subs: PushSub[];
  items: PushItem[];
  /** reminder key → when it was delivered */
  sent: Record<string, number>;
}

export const LATE = 6 * 60 * 60_000; // never deliver reminders that are more than 6 h stale
export const EARLY = 60_000; // the sender runs every 2 minutes: deliver up to 1 minute early rather than late

let vapidP: Promise<{ publicKey: string; privateKey: string }> | null = null;
export function vapid() {
  if (!vapidP)
    vapidP = getOrCreate(configStore(), 'vapid', () => generateVAPIDKeys()).catch((e) => {
      vapidP = null;
      throw e;
    });
  return vapidP;
}

export const emptyPush = (): PushRecord => ({ subs: [], items: [], sent: {} });

/** Earliest reminder still to deliver (0 = nothing to do) — kept in metadata so the sender can skip quickly. */
export function nextDue(r: PushRecord) {
  if (!r.subs.length) return 0;
  let next = 0;
  for (const it of r.items) if (!r.sent[it.key] && (!next || it.at < next)) next = it.at;
  return next;
}
export const pushMeta = (r: PushRecord) => ({ next: nextDue(r), subs: r.subs.length });

export const updatePush = <T>(uid: string, fn: (r: PushRecord) => T) => updateJSON(pushStore(), uid, emptyPush, fn, pushMeta);

export interface SendResult {
  ok: number;
  gone: string[];
  failed: number;
}

/** Sends one notification to each subscription. Subscriptions the push service says are gone are reported. */
export async function sendAll(subs: PushSub[], payload: { title: string; body: string; url: string; tag: string }, subject: string): Promise<SendResult> {
  const keys = await vapid();
  const out: SendResult = { ok: 0, gone: [], failed: 0 };
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), {
          vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 6 * 3600,
          urgency: 'high',
          timeout: 10_000,
        });
        out.ok++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) out.gone.push(s.endpoint);
        else {
          out.failed++;
          console.warn('[kroopy-push] send failed', status, (e as Error).message);
        }
      }
    }),
  );
  return out;
}

/** VAPID needs a contact URL for the push services; the site's own https address works. */
export function subjectFor(siteUrl: string | undefined) {
  return siteUrl && siteUrl.startsWith('https://') ? siteUrl : 'https://kroopy.netlify.app';
}
