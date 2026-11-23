import { Check, Search, X } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { usePlatforms } from '@/lib/hooks';
import type { Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

/* ── Button ── */
type BtnVariant = 'default' | 'primary' | 'lime' | 'ghost' | 'danger' | 'danger-ghost';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  block?: boolean;
  kbd?: string;
  tip?: string;
  tipSide?: 'top' | 'right' | 'bottom';
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'default', size = 'md', icon, iconOnly, loading, block, kbd, tip, tipSide, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        iconOnly && 'btn--icon',
        block && 'btn--block',
        className,
      )}
      data-tip={tip}
      data-tip-side={tipSide}
      aria-label={iconOnly ? (rest['aria-label'] ?? tip) : rest['aria-label']}
      {...rest}
    >
      {loading ? <span className="spinner" /> : icon}
      {!iconOnly && children}
      {kbd && <span className="kbd">{kbd}</span>}
    </button>
  );
});

/* ── Fields ── */
interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
  aside?: ReactNode;
  htmlFor?: string;
}
export function Field({ label, hint, error, required, className, children, aside, htmlFor }: FieldProps) {
  return (
    <div className={cn('field', className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          <span>
            {label}
            {required && <span className="req"> *</span>}
          </span>
          {aside}
        </label>
      )}
      {children}
      {error ? <div className="field__error" role="alert">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; sm?: boolean }>(
  function Input({ className, invalid, sm, ...rest }, ref) {
    return <input ref={ref} className={cn('input', sm && 'input--sm', invalid && 'input--invalid', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }>(
  function Textarea({ className, autoGrow, onInput, ...rest }, ref) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    const grow = () => {
      const el = inner.current;
      if (!el || !autoGrow) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    };
    useEffect(grow, [rest.value, autoGrow]);
    return (
      <textarea
        ref={(el) => {
          inner.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        className={cn('textarea', className)}
        onInput={(e) => {
          grow();
          onInput?.(e);
        }}
        {...rest}
      />
    );
  },
);

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
  sm?: boolean;
}
export function Select({ options, placeholder, className, sm, ...rest }: SelectProps) {
  return (
    <select className={cn('select', sm && 'select--sm', className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn('input-group', className)}>
      <Search />
      <input
        className="input input--sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === 'Escape' && value && (e.stopPropagation(), onChange(''))}
      />
      {value && (
        <button className="btn btn--ghost btn--sm btn--icon input-clear" onClick={() => onChange('')} aria-label="Clear search" style={{ ['--btn-h' as string]: '24px' }}>
          <X />
        </button>
      )}
    </div>
  );
}

/* ── Checkbox / Switch ── */
export function Checkbox({
  checked,
  onChange,
  round,
  sm,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  round?: boolean;
  sm?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={cn('check', round && 'check--round', sm && 'check--sm', checked && 'check--on')}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      <Check />
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={cn('switch', checked && 'switch--on')} onClick={() => onChange(!checked)} />
  );
}

/* ── Segmented / tabs / chips ── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label?: string; icon?: ReactNode; tip?: string }[];
  label: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={cn('seg__btn', value === o.value && 'seg__btn--on')}
          onClick={() => onChange(o.value)}
          data-tip={o.tip}
          aria-label={o.label ?? o.tip}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; icon?: ReactNode; count?: number | string }[];
  className?: string;
}) {
  return (
    <div className={cn('tabs', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={cn('tab', value === t.value && 'tab--on')} onClick={() => onChange(t.value)}>
          {t.icon}
          {t.label}
          {t.count !== undefined && t.count !== 0 && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ChipToggle({
  options,
  value,
  onChange,
  multiple = true,
  sm,
}: {
  options: { value: string; label: string; color?: string; icon?: ReactNode }[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  sm?: boolean;
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={cn('chip', on && 'chip--on', sm && 'chip--sm')}
            aria-pressed={on}
            onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : on ? [] : [o.value])}
          >
            {o.color && <span className="dot" style={{ background: o.color }} />}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder = 'Add tag…', suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').replace(/,$/, '');
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="tag-input">
      {value.map((t) => (
        <span key={t} className="tag">
          #{t}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`}>
            <X />
          </button>
        </span>
      ))}
      <input
        value={draft}
        list={suggestions.length ? listId : undefined}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        aria-label="Tags"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/* ── Small display bits ── */
export function PriorityTag({ p, label = true }: { p: Priority; label?: boolean }) {
  return (
    <span className="prio" data-p={p} title={`${p} priority`}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        <i />
        <i />
        <i />
      </span>
      {label && <span style={{ textTransform: 'capitalize' }}>{p}</span>}
    </span>
  );
}

export function PlatformBadges({ ids, max = 3, compact }: { ids: string[]; max?: number; compact?: boolean }) {
  const { get } = usePlatforms();
  if (!ids.length) return null;
  const shown = ids.slice(0, max);
  return (
    <span className="row gap-4 wrap">
      {shown.map((id) => {
        const p = get(id);
        if (!p) return null;
        return (
          <span key={id} className="plat" title={p.name}>
            <span className="dot" style={{ background: p.color }} />
            {compact ? p.short : p.name}
          </span>
        );
      })}
      {ids.length > max && <span className="plat">+{ids.length - max}</span>}
    </span>
  );
}

export function PlatformDots({ ids }: { ids: string[] }) {
  const { get } = usePlatforms();
  return (
    <span className="row" style={{ gap: 3 }}>
      {ids.map((id) => {
        const p = get(id);
        return p ? <span key={id} className="dot" style={{ background: p.color, width: 7, height: 7 }} title={p.name} /> : null;
      })}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function PageHeader({
  title,
  sub,
  actions,
  eyebrow,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 12 }}>{eyebrow}</div>}
        <h1 className="page-title">
          {title}
          <span className="stop" aria-hidden />
        </h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
