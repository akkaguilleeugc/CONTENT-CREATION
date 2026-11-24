/* Achievement micro-animations.
   Watches the store for real accomplishments — a task done, a habit checked in, a checklist finished,
   a video published, a goal met, an idea turned into a video — and answers with a small burst where the
   user just clicked or tapped. Changes that arrive from sync, imports or sample data never celebrate:
   only something the person did in the last moment does. */
import { goalValue } from './metrics';
import { haptic } from './pwa';
import { useStore, type Store } from './store';

export type Achievement = 'task' | 'subtask' | 'habit' | 'checklist' | 'idea' | 'published' | 'goal';

const BIG: Achievement[] = ['published', 'goal', 'checklist'];
const COLORS = ['#D4F53C', '#2F5BFF', '#FF0055', '#EFF8FF', '#BBEF1F'];

let lastPoint = { x: -1, y: -1, t: 0 };
let lastInput = 0;

function reduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A small burst: a ring that opens and a few sparks, in brand colours. */
export function celebrate(kind: Achievement, at?: { x: number; y: number }) {
  if (typeof document === 'undefined') return;
  const recent = performance.now() - lastPoint.t < 1500 && lastPoint.x >= 0;
  const x = at?.x ?? (recent ? lastPoint.x : window.innerWidth / 2);
  const y = at?.y ?? (recent ? lastPoint.y : window.innerHeight - 120);
  const big = BIG.includes(kind);
  haptic(big ? 14 : 8);
  if (reduced()) return;

  const host = document.createElement('div');
  host.className = 'burst';
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  document.body.appendChild(host);

  const ring = document.createElement('span');
  ring.className = 'burst__ring';
  host.appendChild(ring);
  const size = big ? 96 : 54;
  ring.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.9, width: `${size}px`, height: `${size}px` },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0, width: `${size}px`, height: `${size}px` },
    ],
    { duration: big ? 720 : 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
  );

  const n = big ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'burst__spark';
    const c = COLORS[i % COLORS.length]!;
    s.style.background = c;
    const r = (big ? 4 : 3) + (i % 3);
    s.style.width = s.style.height = `${r}px`;
    host.appendChild(s);
    const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
    const d = (big ? 46 : 26) + (i % 4) * (big ? 9 : 5);
    s.animate(
      [
        { transform: 'translate(-50%, -50%) translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(-50%, -50%) translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: (big ? 760 : 560) + (i % 3) * 60, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
    );
  }
  if (big) {
    const word = document.createElement('b');
    word.className = 'burst__word';
    word.textContent = kind === 'published' ? '🚀' : kind === 'goal' ? '🏆' : '✓';
    host.appendChild(word);
    word.animate(
      [
        { transform: 'translate(-50%, -50%) translateY(0) scale(0.6)', opacity: 0 },
        { transform: 'translate(-50%, -50%) translateY(-26px) scale(1)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%, -50%) translateY(-40px) scale(0.95)', opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    );
  }
  setTimeout(() => host.remove(), 1100);
}

/* ── Detection ─────────────────────────────────────────────── */
function metGoals(s: Store): Set<string> {
  const out = new Set<string>();
  for (const g of s.goals) {
    try {
      if (goalValue(s, g).pct >= 100) out.add(g.id);
    } catch {
      /* ignore malformed goals */
    }
  }
  return out;
}

function checklistsDone(s: Store): Set<string> {
  const out = new Set<string>();
  for (const p of s.projects) {
    for (const [k, list] of [['p', p.production], ['e', p.editing]] as const) {
      if (list && list.length > 0 && list.every((i) => i.done)) out.add(`${p.id}:${k}`);
    }
  }
  return out;
}

export function startAchievements() {
  const note = (e: PointerEvent | KeyboardEvent) => {
    lastInput = performance.now();
    if ('clientX' in e) lastPoint = { x: e.clientX, y: e.clientY, t: lastInput };
  };
  window.addEventListener('pointerdown', note, { capture: true, passive: true });
  window.addEventListener('keydown', note, { capture: true, passive: true });

  let goals = metGoals(useStore.getState());
  let lists = checklistsDone(useStore.getState());
  const unsub = useStore.subscribe((s, prev) => {
    if (s.rev === prev.rev) return;
    const byUser = performance.now() - lastInput < 1200;
    const fired: Achievement[] = [];

    if (s.tasks !== prev.tasks) {
      const before = new Map(prev.tasks.map((t) => [t.id, t]));
      for (const t of s.tasks) {
        const p = before.get(t.id);
        if (!p) continue;
        if (p.status !== 'done' && t.status === 'done') fired.push('task');
        else if (t.subtasks.filter((x) => x.done).length > p.subtasks.filter((x) => x.done).length) fired.push('subtask');
      }
    }
    if (s.habitLogs !== prev.habitLogs && s.habitLogs.length > prev.habitLogs.length) fired.push('habit');
    if (s.projects !== prev.projects) {
      const before = new Map(prev.projects.map((p) => [p.id, p]));
      for (const p of s.projects) {
        const q = before.get(p.id);
        if (q && q.stage !== 'published' && p.stage === 'published') fired.push('published');
      }
      const now = checklistsDone(s);
      for (const k of now) if (!lists.has(k)) fired.push('checklist');
      lists = now;
    }
    if (s.ideas !== prev.ideas) {
      const before = new Map(prev.ideas.map((i) => [i.id, i]));
      for (const i of s.ideas) if (before.get(i.id) && before.get(i.id)!.status !== 'converted' && i.status === 'converted') fired.push('idea');
    }
    const g = metGoals(s);
    for (const id of g) if (!goals.has(id)) fired.push('goal');
    goals = g;

    if (!byUser || fired.length === 0 || fired.length > 3) return;
    const best = fired.find((k) => BIG.includes(k)) ?? fired[0]!;
    requestAnimationFrame(() => celebrate(best));
  });
  return () => {
    unsub();
    window.removeEventListener('pointerdown', note, { capture: true });
    window.removeEventListener('keydown', note, { capture: true });
  };
}
