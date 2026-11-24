/*
 * GlassSurface — Apple-style liquid glass (liquid-glass-react) as a surface material.
 *
 * liquid-glass-react renders a stack of absolutely-positioned layers that refract
 * whatever is *behind* them. We mount it as a background layer behind the real content,
 * so the content stays in normal flow (forms, lists, flex/grid layouts keep working),
 * and size it to the host with a ResizeObserver.
 *
 * Notes on the library that shape this wrapper:
 *  - it measures its own size only on mount / window resize; that measurement now only drives the
 *    rim layers we hide, while the refracting layer is sized by our sizer element, so no re-measure
 *    is needed (dispatching a synthetic `resize` would also cancel dnd-kit drags);
 *  - it relies on a few Tailwind utility classes → shimmed in styles/glass.css;
 *  - backdrop refraction disappears inside an ancestor with opacity < 1 / filter → hosts animate with transform only;
 *  - elasticity is kept at 0 so the glass never drifts away from its content;
 *  - its rim/hover layers use mix-blend-mode, which isolates the stacking context and blanks the
 *    backdrop — they are hidden (styles/glass.css) and the rim is redrawn with normal blending.
 */
import LiquidGlass from 'liquid-glass-react';
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export type GlassTone = 'chrome' | 'sheet' | 'lens';

const PRESETS: Record<GlassTone, { displacementScale: number; blurAmount: number; saturation: number; aberrationIntensity: number; mode: 'standard' | 'polar' | 'prominent' }> = {
  /** Bars, toasts, menus: crisp refraction, light frost. */
  chrome: { displacementScale: 64, blurAmount: 0.08, saturation: 160, aberrationIntensity: 2, mode: 'standard' },
  /** Dialogs and the command palette: heavier frost so text stays legible. */
  sheet: { displacementScale: 48, blurAmount: 0.42, saturation: 150, aberrationIntensity: 1.5, mode: 'standard' },
  /** Dragged items: a strong lens over the content underneath. */
  lens: { displacementScale: 96, blurAmount: 0.02, saturation: 170, aberrationIntensity: 3, mode: 'prominent' },
};

export const useLiquidGlassEnabled = () => useStore((s) => s.settings.liquidGlass !== false);

interface GlassSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  radius: number;
  tone?: GlassTone;
  children?: ReactNode;
}

export const GlassSurface = forwardRef<HTMLElement, GlassSurfaceProps>(function GlassSurface(
  { as: Tag = 'div', radius, tone = 'chrome', className, children, onAnimationEnd, style, ...rest },
  forwarded,
) {
  const enabled = useLiquidGlassEnabled();
  const host = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || !enabled) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);

  // Reveal the glass one frame after it mounts so its SVG filter is in place.
  useEffect(() => {
    if (!size || ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [size, ready]);

  const setRef = (el: HTMLElement | null) => {
    host.current = el;
    if (typeof forwarded === 'function') forwarded(el);
    else if (forwarded) forwarded.current = el;
  };

  return (
    <Tag
      ref={setRef}
      className={cn('lg-host', enabled ? 'lg-on' : 'lg-off', `lg-${tone}`, className)}
      {...rest}
      style={{ ...style, ['--lg-radius' as string]: `${radius}px` }}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        // Rim highlight follows the pointer, like Apple's glass catching the light.
        if (!enabled || e.pointerType !== 'mouse') return rest.onPointerMove?.(e);
        const r = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        e.currentTarget.style.setProperty('--lg-angle', `${135 + dx * 60}deg`);
        e.currentTarget.style.setProperty('--lg-rim-a', String(0.28 + Math.abs(dx) * 0.25));
        e.currentTarget.style.setProperty('--lg-rim-b', String(0.45 + Math.abs(dy) * 0.3));
        rest.onPointerMove?.(e);
      }}
      onAnimationEnd={onAnimationEnd}
    >
      {enabled && size && size.w > 0 && size.h > 0 && (
        <span className={cn('lg-layer', ready && 'lg-layer--ready')} aria-hidden>
          <LiquidGlass
            {...PRESETS[tone]}
            cornerRadius={radius}
            padding="0"
            elasticity={0}
            overLight={false}
            style={{ position: 'absolute', top: '50%', left: '50%' }}
          >
            <span className="lg-sizer" style={{ width: size.w, height: size.h }} />
          </LiquidGlass>
          <span className="lg-tint" />
        </span>
      )}
      {children}
    </Tag>
  );
});
