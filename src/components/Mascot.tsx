/* Kroo — KROOPY's mascot and the face of KROOPY AI.
   An original character (src/assets/kroo.avatar.json) drawn by @bible-strong/avatar-react (MIT):
   one inline SVG, animated frame by frame without React renders; it settles when idle, pauses
   off-screen and holds still with “reduce motion”.

   The renderer is loaded on demand so it never slows the app's first paint. To use another
   character, export it from Avatar Lab and replace the JSON file. */
import { lazy, Suspense, useRef, type CSSProperties } from 'react';
import { $t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** States of the shared catalogue we use (see @bible-strong/avatar-core `stateNames`). */
export type MascotState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'streaming'
  | 'writing'
  | 'searching'
  | 'working'
  | 'happy'
  | 'excited'
  | 'proud'
  | 'celebrate'
  | 'curious'
  | 'confused'
  | 'waiting'
  | 'failed'
  | 'sleeping';

export interface MascotProps {
  state?: MascotState;
  size?: number;
  /** The head follows the pointer (desktop). */
  followPointer?: boolean;
  /** Settle (stop animating) this long after the last change — for decorative placements. */
  settleAfterMs?: number;
  /** Tapping Kroo makes it bounce; give `onClick` to make it do something else too. */
  onClick?: () => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const Renderer = lazy(() => import('./MascotRenderer'));

export function Mascot({ size = 96, className, style, onClick, label, ...rest }: MascotProps) {
  const poke = useRef<((g: 'nod' | 'bounce' | 'spin') => void) | null>(null);
  const name = label ?? $t('Kroo, the KROOPY assistant');
  return (
    <button
      type="button"
      className={cn('mascot', className)}
      style={{ width: size, height: size, ...style }}
      aria-label={name}
      onClick={() => {
        poke.current?.('bounce');
        onClick?.();
      }}
    >
      <Suspense fallback={<span className="mascot__fallback" aria-hidden />}>
        <Renderer size={size} ariaLabel={name} pokeRef={poke} {...rest} />
      </Suspense>
    </button>
  );
}
