import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn, compact, prefersReducedMotion } from '@/lib/utils';

/* ── Animated counter ── */
export function AnimatedNumber({ value, format = (n: number) => compact(n), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(2, -10 * p);
      const v = a + (value - a) * (p === 1 ? 1 : e);
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  const isInt = Number.isInteger(value);
  return <span className="tnum">{format(isInt ? Math.round(shown) : Math.round(shown * 10) / 10)}</span>;
}

/* ── Progress ring ── */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  accent,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  accent?: boolean;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={cn('ring', accent && 'ring--accent')} style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(value)}%`}>
      <svg width={size} height={size}>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ opacity: value > 0 ? 1 : 0 }}
        />
      </svg>
      <div className="ring__label">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, accent, lg, label }: { value: number; accent?: boolean; lg?: boolean; label?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={cn('bar', accent && 'bar--accent', lg && 'bar--lg')} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar__fill" style={{ width: `${v}%`, opacity: value > 0 ? 1 : 0 }} />
    </div>
  );
}

/* ── Responsive width helper ── */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e!.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => {
  if (v <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
};

/* ── Line / area chart ── */
export interface Series {
  label: string;
  values: number[];
  color: string;
}
export function LineChart({ labels, series, height = 220, format = compact }: { labels: string[]; series: Series[]; height?: number; format?: (n: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const iw = Math.max(10, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(iw / 64))));
  const gid = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div ref={ref} className="chart" style={{ height, position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - r.left;
            const i = Math.round(((px - pad.l) / iw) * (labels.length - 1));
            setHover(Math.max(0, Math.min(labels.length - 1, i)));
          }}
        >
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`${gid}-${si}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '2 4'} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-3)" className="tnum">
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % every === 0 || i === labels.length - 1 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-3)">
                {l}
              </text>
            ) : null,
          )}
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
            if (!pts.length) return null;
            const line = `M${pts.join(' L')}`;
            const area = `${line} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
            return (
              <g key={si}>
                <path d={area} fill={`url(#${gid}-${si})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" className="chart-line" />
                {s.values.length === 1 && <circle cx={x(0)} cy={y(s.values[0]!)} r={4} fill={s.color} />}
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--border-hover)" />
              {series.map((s, si) => (
                <circle key={si} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill="var(--bg)" stroke={s.color} strokeWidth={2.2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div className="chart-tip" style={{ left: Math.min(width - 150, Math.max(0, x(hover) + 10)), top: 8 }}>
          <div className="chart-tip__label">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.label} className="row" style={{ gap: 6 }}>
              <span className="dot" style={{ background: s.color }} />
              <span className="grow">{s.label}</span>
              <b className="tnum">{format(s.values[hover] ?? 0)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Vertical bar chart ── */
export function BarChart({
  data,
  height = 180,
  format = compact,
  highlight,
}: {
  data: { label: string; value: number; color?: string; sub?: string }[];
  height?: number;
  format?: (n: number) => string;
  highlight?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="bars" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className={cn('bars__col', highlight === i && 'bars__col--hl')} title={`${d.label}: ${format(d.value)}`}>
          <div className="bars__value tnum">{d.value ? format(d.value) : ''}</div>
          <div className="bars__track">
            <div
              className="bars__fill"
              style={{
                height: mounted ? `${(d.value / max) * 100}%` : 0,
                background: d.color,
                transitionDelay: `${i * 40}ms`,
              }}
            />
          </div>
          <div className="bars__label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Horizontal ranked bars ── */
export function RankBars({ data, format = compact }: { data: { label: ReactNode; value: number; color?: string; key: string; sub?: ReactNode }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rank">
      {data.map((d) => (
        <div key={d.key} className="rank__row">
          <div className="rank__head">
            <span className="rank__label">{d.label}</span>
            <span className="rank__value tnum">{format(d.value)}</span>
          </div>
          <div className="bar">
            <div className="bar__fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color, boxShadow: 'none' }} />
          </div>
          {d.sub && <div className="rank__sub">{d.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── Sparkline ── */
export function Sparkline({ values, color = 'var(--lime)', width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - (v / max) * (height - 4)}`);
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={`M${pts.join(' L')}`} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
