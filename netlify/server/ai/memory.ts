/* KROOPY AI memory and activity log, per account (store `kroopy-ai`):
   <uid>/memory    what the person asked KROOPY AI to keep in mind (preferences, decisions, facts)
   <uid>/activity  what KROOPY AI did or proposed (searches, saved memories, confirmed / cancelled actions) */
import { aiStore, updateJSON } from '../store';

export type MemoryKind = 'preference' | 'decision' | 'fact' | 'goal';
export interface Memory {
  id: string;
  text: string;
  kind: MemoryKind;
  created: number;
}
export interface Activity {
  at: number;
  tool: string;
  summary: string;
  status: 'done' | 'cancelled' | 'proposed' | 'error';
}

const MAX_MEMORIES = 300;
const MAX_ACTIVITY = 300;

export async function listMemories(uid: string): Promise<Memory[]> {
  return ((await aiStore().get(`${uid}/memory`, { type: 'json' })) as Memory[] | null) ?? [];
}

export async function addMemory(uid: string, text: string, kind: MemoryKind): Promise<Memory> {
  const m: Memory = { id: crypto.randomUUID(), text: text.trim().slice(0, 500), kind, created: Date.now() };
  await updateJSON<Memory[], void>(aiStore(), `${uid}/memory`, () => [], (list) => {
    // an identical memory is kept once
    const rest = list.filter((x) => x.text.toLowerCase() !== m.text.toLowerCase());
    list.splice(0, list.length, m, ...rest.slice(0, MAX_MEMORIES - 1));
  });
  return m;
}

export async function deleteMemory(uid: string, id: string | null) {
  await updateJSON<Memory[], void>(aiStore(), `${uid}/memory`, () => [], (list) => {
    const keep = id ? list.filter((x) => x.id !== id) : [];
    list.splice(0, list.length, ...keep);
  });
}

export async function listActivity(uid: string): Promise<Activity[]> {
  return ((await aiStore().get(`${uid}/activity`, { type: 'json' })) as Activity[] | null) ?? [];
}

export async function logActivity(uid: string, entries: Activity[]) {
  if (!entries.length) return;
  await updateJSON<Activity[], void>(aiStore(), `${uid}/activity`, () => [], (list) => {
    list.splice(0, list.length, ...entries, ...list.slice(0, MAX_ACTIVITY - entries.length));
  });
}
