/* ──────────────────────────────────────────────────────────────
   Which model answers. The chat asks for a *role*; this module maps
   it to a provider model, so switching provider or model never
   touches the chat. Today: OpenAI (direct, the user's own key).

   quick → titles, captions, short rewrites   (GPT-6 Luna)
   chat  → the conversation                   (GPT-6 Terra)
   deep  → strategy, analysis, long scripts   (GPT-6 Sol)

   The newest model of each family the key can use is picked from
   OpenAI's own model list, so a new version (e.g. 6.2 → 6.3) is used
   without a code change. KROOPY_AI_MODEL_<ROLE> pins one by hand.
   Prices: https://developers.openai.com/api/docs/pricing (checked 2026-11-24).
   ────────────────────────────────────────────────────────────── */
import { createOpenAI } from '@ai-sdk/openai';

export type Role = 'quick' | 'chat' | 'deep';
export const FAMILY: Record<Role, string> = { quick: 'luna', chat: 'terra', deep: 'sol' };
const FALLBACK: Record<Role, string> = { quick: 'gpt-6-luna', chat: 'gpt-6.1-terra', deep: 'gpt-6.2-sol' };
/** USD per 1M tokens [input, output], by family. Used for quotas and the cost log (an estimate). */
const PRICE: Record<string, [number, number]> = { luna: [0.1, 0.5], terra: [1, 5], sol: [2, 10], astra: [8, 40] };

export const apiKey = () => Netlify.env.get('OPENAI_API_KEY') || '';
export const configured = () => !!apiKey();

let cache: { at: number; ids: string[] } | null = null;
async function availableModels(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 60 * 60_000) return cache.ids;
  const res = await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${apiKey()}` } });
  if (!res.ok) throw new Error(`OpenAI models list: ${res.status}`);
  const { data } = (await res.json()) as { data: { id: string }[] };
  cache = { at: Date.now(), ids: data.map((m) => m.id) };
  return cache.ids;
}

const version = (id: string) => (id.match(/^gpt-(\d+(?:\.\d+)?)-/)?.[1] ?? '0').split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [version(a), version(b)];
  return (x[0]! - y[0]!) || ((x[1] ?? 0) - (y[1] ?? 0));
};

/** The model id for a role: pinned by env, else the newest of its family the key can use. */
export async function modelFor(role: Role): Promise<string> {
  const pinned = Netlify.env.get(`KROOPY_AI_MODEL_${role.toUpperCase()}`);
  if (pinned) return pinned;
  try {
    const ids = await availableModels();
    const family = ids.filter((id) => new RegExp(`^gpt-\\d+(\\.\\d+)?-${FAMILY[role]}$`).test(id)).sort((a, b) => newer(b, a));
    if (family[0]) return family[0];
  } catch (e) {
    console.warn('[kroopy-ai] could not list models', (e as Error).message);
  }
  return FALLBACK[role];
}

export function provider() {
  return createOpenAI({ apiKey: apiKey() });
}

/** Estimated cost in USD of a call, from the model's family price. */
export function costOf(modelId: string, inputTokens = 0, outputTokens = 0) {
  const family = Object.keys(PRICE).find((f) => modelId.includes(`-${f}`)) ?? 'sol';
  const [pin, pout] = PRICE[family]!;
  return (inputTokens * pin + outputTokens * pout) / 1_000_000;
}

/** The conversation uses «chat»; the «Think deeper» switch uses «deep». */
export const roleFor = (deep: boolean): Role => (deep ? 'deep' : 'chat');
