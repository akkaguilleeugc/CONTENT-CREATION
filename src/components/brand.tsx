import { cn } from '@/lib/utils';

/** The KROOPY symbol (original artwork) on a lime plate — used where space is compact. */
export function BrandMark({ className, size }: { className?: string; size?: number }) {
  return (
    <span className={cn('brand-mark', className)} style={size ? { width: size, height: size, padding: `${size * 0.22}px ${size * 0.17}px` } : undefined}>
      <img src="/brand/kroopy-symbol.png" alt="KROOPY" width={400} height={282} draggable={false} />
    </span>
  );
}

/** The KROOPY horizontal logotype (original artwork). On a plate, or bare: `tone="auto"` is white on the dark
 *  theme and the original black on the light theme. */
export function Wordmark({ height = 22, plate = 'ice', tone = 'black', className }: { height?: number; plate?: 'ice' | 'lime' | 'white' | 'none'; tone?: 'black' | 'auto'; className?: string }) {
  if (tone === 'auto')
    return (
      <span className={cn('wordmark wordmark--auto', className)} style={{ display: 'inline-flex', alignItems: 'center', height }}>
        <img className="wordmark__on-dark" src="/brand/kroopy-logo-white.png" alt="KROOPY" style={{ height: '100%', width: 'auto' }} draggable={false} />
        <img className="wordmark__on-light" src="/brand/kroopy-logo.png" alt="" aria-hidden style={{ height: '100%', width: 'auto' }} draggable={false} />
      </span>
    );
  const bg = plate === 'ice' ? 'var(--ice)' : plate === 'lime' ? 'var(--lime)' : plate === 'white' ? '#fff' : 'transparent';
  const pad = plate === 'none' ? 0 : Math.round(height * 0.22);
  return (
    <span
      className={cn('wordmark', className)}
      style={{ display: 'inline-flex', alignItems: 'center', height, padding: `${pad}px ${pad * 2}px`, background: bg, borderRadius: Math.round(height * 0.32) }}
    >
      <img src="/brand/kroopy-logo.png" alt="KROOPY" style={{ height: '100%', width: 'auto' }} draggable={false} />
    </span>
  );
}
