/* Pointer-driven ambience: a brand glow that follows the mouse (or the finger on phones) behind the
   interface, and a custom cursor — the dot follows instantly, the ring arrives later; that difference in
   lag is what gives it weight. Both stay off for reduced motion, and the cursor only appears with a mouse. */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

const INTERACTIVE = 'a, button, [role="button"], [role="tab"], [role="checkbox"], [role="option"], [role="switch"], select, summary, label, input[type="checkbox"], input[type="radio"], input[type="range"], input[type="color"], [data-cursor="hover"], .kcard, .hday, .heatmap__cell';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]';

/** Soft royal + lime light that trails the pointer across the app background. */
export function PointerGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    const a = el.children[0] as HTMLElement, b = el.children[1] as HTMLElement;
    const target = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.15 };
    const cur = { ...target };
    let energy = 0; // grows with movement, fades when still — the glow breathes with the hand
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last) / 16.67;
      last = now;
      cur.x = lerp(cur.x, target.x, 1 - Math.pow(1 - 0.085, dt));
      cur.y = lerp(cur.y, target.y, 1 - Math.pow(1 - 0.085, dt));
      energy = Math.max(0, energy - 0.012 * dt);
      a.style.transform = `translate3d(${cur.x - 600}px, ${cur.y - 600}px, 0) scale(${1 + energy * 0.12})`;
      b.style.transform = `translate3d(${cur.x - 260}px, ${cur.y - 260}px, 0) scale(${0.9 + energy * 0.25})`;
      a.style.opacity = (0.55 + energy * 0.45).toFixed(3);
      b.style.opacity = (0.25 + energy * 0.75).toFixed(3);
      const settled = Math.abs(cur.x - target.x) < 0.4 && Math.abs(cur.y - target.y) < 0.4 && energy === 0;
      raf = settled ? 0 : requestAnimationFrame(step);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && e.type === 'pointermove' && !e.isPrimary) return;
      const dx = e.clientX - target.x, dy = e.clientY - target.y;
      target.x = e.clientX;
      target.y = e.clientY;
      energy = Math.min(1, energy + Math.hypot(dx, dy) / 900);
      kick();
    };
    const down = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      energy = Math.min(1, energy + 0.35);
      kick();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    kick();
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className="pointer-glow" aria-hidden>
      <span className="pointer-glow__a" />
      <span className="pointer-glow__b" />
    </div>
  );
}

/** The custom cursor: dot + ring, reacting to hover and clicks. Mouse / trackpad only. */
export function CustomCursor() {
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const dot = dotRef.current, ring = ringRef.current;
    if (!dot || !ring || !finePointer() || reduced()) return;
    const root = document.documentElement;
    root.classList.add('has-cursor');
    const target = { x: -100, y: -100 }, cur = { x: -100, y: -100 };
    let visible = false, hovering = false, text = false, pressed = false;
    let ringScale = 1, dotScale = 1, raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last) / 16.67;
      last = now;
      cur.x = lerp(cur.x, target.x, 1 - Math.pow(1 - 0.14, dt)); /* the lag lives here */
      cur.y = lerp(cur.y, target.y, 1 - Math.pow(1 - 0.14, dt));
      const rs = pressed ? 0.72 : hovering ? 1.55 : 1;
      const ds = pressed ? 1.8 : hovering ? 0.45 : 1;
      ringScale = lerp(ringScale, rs, 1 - Math.pow(1 - 0.22, dt));
      dotScale = lerp(dotScale, ds, 1 - Math.pow(1 - 0.3, dt));
      dot.style.transform = `translate3d(${target.x - 5}px, ${target.y - 5}px, 0) scale(${dotScale})`;
      ring.style.transform = `translate3d(${cur.x - 19}px, ${cur.y - 19}px, 0) scale(${ringScale})`;
      const settled = Math.abs(cur.x - target.x) < 0.2 && Math.abs(cur.y - target.y) < 0.2 && Math.abs(ringScale - rs) < 0.002 && Math.abs(dotScale - ds) < 0.002;
      raf = settled ? 0 : requestAnimationFrame(step);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const setVisible = (v: boolean) => {
      visible = v;
      dot.style.opacity = ring.style.opacity = v && !text ? '1' : '0';
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        cur.x = target.x;
        cur.y = target.y;
        setVisible(true);
      }
      const el = e.target as Element | null;
      const t = !!el?.closest?.(TEXT);
      const h = !t && !!el?.closest?.(INTERACTIVE);
      if (t !== text || h !== hovering) {
        text = t;
        hovering = h;
        ring.classList.toggle('cursor-ring--hover', h);
        setVisible(true);
      }
      kick();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      pressed = true;
      ring.classList.add('cursor-ring--press');
      kick();
    };
    const up = () => {
      pressed = false;
      ring.classList.remove('cursor-ring--press');
      kick();
    };
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) setVisible(false);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('blur', up);
    document.addEventListener('mouseout', leave);
    return () => {
      root.classList.remove('has-cursor');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur', up);
      document.removeEventListener('mouseout', leave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return createPortal(
    <>
      <span ref={ringRef} className="cursor-ring" aria-hidden />
      <span ref={dotRef} className="cursor-dot" aria-hidden />
    </>,
    document.body,
  );
}
