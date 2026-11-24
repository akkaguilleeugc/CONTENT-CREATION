/* Delivers reminder notifications to phones and computers, even when KROOPY is closed.
   Runs every 2 minutes (UTC cron — reminder times are stored as absolute timestamps, so time zones
   don't matter here). Each account's devices keep its list of upcoming reminders up to date. */
import type { Config, Context } from '@netlify/functions';
import { EARLY, LATE, type PushRecord, sendAll, subjectFor, updatePush } from '../server/push';
import { pushStore, scopeStores } from '../server/store';

export default async (_req: Request, ctx: Context) => {
  scopeStores(ctx.deploy?.context);
  const store = pushStore();
  const now = Date.now();
  const { blobs } = await store.list();
  let delivered = 0;
  for (const { key: uid } of blobs) {
    try {
      const meta = await store.getMetadata(uid);
      const next = Number(meta?.metadata.next || 0);
      if (!meta || !Number(meta.metadata.subs) || !next || next > now + EARLY) continue;

      // Claim the due reminders first (atomic write), then send — a reminder is never sent twice.
      const claimed = await updatePush(uid, (r: PushRecord) => {
        const due = r.items.filter((i) => !r.sent[i.key] && i.at <= now + EARLY);
        for (const i of due) r.sent[i.key] = now;
        return { due: due.filter((i) => i.at > now - LATE), subs: r.subs };
      });
      const gone = new Set<string>();
      for (const item of claimed.due) {
        const res = await sendAll(claimed.subs.filter((s) => !gone.has(s.endpoint)), { title: item.title, body: item.body, url: item.url, tag: item.key }, subjectFor(ctx.site?.url));
        res.gone.forEach((e) => gone.add(e));
        delivered += res.ok;
      }
      if (gone.size) await updatePush(uid, (r) => void (r.subs = r.subs.filter((s) => !gone.has(s.endpoint))));
    } catch (e) {
      console.error('[kroopy-push] account failed', e);
    }
  }
  if (delivered) console.log(`[kroopy-push] delivered ${delivered} notification(s)`);
};

export const config: Config = {
  // Every 2 minutes, all day (UTC). Reminders carry their own absolute time, so no time-zone math is needed.
  schedule: '*/2 * * * *',
};

