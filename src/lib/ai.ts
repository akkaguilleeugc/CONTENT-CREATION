/* KROOPY AI — client side: the account's token, conversation list and status. The conversation
   itself streams through useChat (src/pages/Ai.tsx) to /api/ai/chat. */

export interface AiStatus {
  configured: boolean;
  provider: string;
  usage: { month: number; today: number; messagesToday: number };
  limits: { daily: number; monthly: number };
}
export interface ConvMeta {
  id: string;
  title: string;
  created: number;
  updated: number;
}

/** The signed-in account's token (stored by src/lib/cloud/netlify.ts). */
export function aiToken(): string | null {
  try {
    return (JSON.parse(localStorage.getItem('kroopy-cloud-session') || 'null') as { token?: string } | null)?.token ?? null;
  } catch {
    return null;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = aiToken();
  const res = await fetch(`/api/ai${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `${res.status}`);
  }
  return (await res.json()) as T;
}

export const aiStatus = () => call<AiStatus>('/status');
export const listConversations = () => call<ConvMeta[]>('/conversations');
export const loadConversation = (id: string) => call<ConvMeta & { messages: unknown[] }>(`/conversations/${encodeURIComponent(id)}`);
export const renameConversation = (id: string, title: string) => call(`/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) });
export const deleteConversation = (id: string) => call(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Readable text of a chat error (the server sends { error } as JSON). */
export function aiErrorText(e: Error | undefined) {
  if (!e) return '';
  try {
    const j = JSON.parse(e.message) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* plain text */
  }
  return e.message;
}

/* ── memory ── */
export interface AiMemory {
  id: string;
  text: string;
  kind: 'preference' | 'decision' | 'fact' | 'goal';
  created: number;
}
export interface AiActivity {
  at: number;
  tool: string;
  summary: string;
  status: 'done' | 'cancelled' | 'proposed' | 'error';
}
export const loadMemories = () => call<{ memories: AiMemory[]; activity: AiActivity[] }>('/memories');
export const forgetMemory = (id: string) => call(`/memories/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const forgetAllMemories = () => call('/memories', { method: 'DELETE' });
