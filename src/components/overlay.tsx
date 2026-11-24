import { AlertTriangle, Check, Info, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { dismissToast, useUI } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { GlassSurface } from './Glass';
import { Button } from './ui';

import { $t } from '@/lib/i18n';
/* Body scroll lock shared by every overlay. */
let locks = 0;
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks++;
    document.body.style.overflow = 'hidden';
    return () => {
      locks--;
      if (!locks) document.body.style.overflow = '';
    };
  }, [active]);
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ── Modal (centered dialog on desktop, bottom sheet on phones) ── */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initialFocus?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (el && initialFocus) {
      const first = el.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), textarea, select');
      (first ?? el).focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0]!;
        const last = nodes[nodes.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Phones: drag the sheet down by its handle/header to dismiss it, like a native bottom sheet.
  const drag = useRef<{ y: number; t: number; id: number } | null>(null);
  const [dy, setDy] = useState(0);
  const sheetHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (window.innerWidth > 640 || (e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      drag.current = { y: e.clientY, t: performance.now(), id: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (drag.current?.id === e.pointerId) setDy(Math.max(0, e.clientY - drag.current.y));
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      const dist = Math.max(0, e.clientY - d.y);
      const velocity = dist / Math.max(1, performance.now() - d.t);
      if (dist > 120 || velocity > 0.7) onClose();
      else setDy(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDy(0);
    },
  };

  if (!open) return null;
  return createPortal(
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} style={dy ? { opacity: Math.max(0.2, 1 - dy / 400) } : undefined} />
      <GlassSurface
        ref={ref as React.Ref<HTMLElement>}
        radius={28}
        tone="sheet"
        className={cn('modal', size !== 'md' && `modal--${size}`, dy > 0 && 'modal--dragging')}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={dy ? { transform: `translateY(${dy}px)`, animation: 'none' } : undefined}
      >
        <div className="modal__drag" {...sheetHandlers}>
          <div className="modal__grab" />
        <div className="modal__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="modal__title">{title}</h2>
            {description && <p className="modal__desc">{description}</p>}
          </div>
          <Button variant="ghost" iconOnly size="sm" icon={<X />} onClick={onClose} aria-label={$t("Close")} />
        </div>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </GlassSurface>
    </div>,
    document.body,
  );
}

/* ── Popover anchored to a trigger ── */
export function usePopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const toggle = useCallback((el: HTMLElement) => setAnchor((a) => (a ? null : el)), []);
  const close = useCallback(() => setAnchor(null), []);
  return { anchor, open: !!anchor, toggle, close };
}

export function Popover({
  anchor,
  onClose,
  children,
  align = 'start',
  width,
  className,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const el = ref.current!;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, align]);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;
  return createPortal(
    <GlassSurface
      ref={ref as React.Ref<HTMLElement>}
      radius={14}
      tone="sheet"
      className={cn('popover', className)}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? 'visible' : 'hidden' }}
      role="menu"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const items = Array.from(ref.current!.querySelectorAll<HTMLElement>('.menu__item'));
        const i = items.indexOf(document.activeElement as HTMLElement);
        const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[n]?.focus();
      }}
    >
      {children}
    </GlassSurface>,
    document.body,
  );
}

export interface MenuEntry {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  separator?: boolean;
  hidden?: boolean;
}

/** Trigger + dropdown menu. */
export function Menu({ trigger, items, align = 'end', width = 210 }: { trigger: (p: { onClick: (e: React.MouseEvent<HTMLElement>) => void; 'aria-expanded': boolean }) => ReactNode; items: MenuEntry[]; align?: 'start' | 'end'; width?: number }) {
  const pop = usePopover();
  return (
    <>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          pop.toggle(e.currentTarget);
        },
        'aria-expanded': pop.open,
      })}
      <Popover anchor={pop.anchor} onClose={pop.close} align={align} width={width}>
        <div onClick={(e) => e.stopPropagation()}>
          {items
            .filter((i) => !i.hidden)
            .map((i, idx) => (
              <div key={idx}>
                {i.separator && <div className="menu__sep" />}
                <button
                  className={cn('menu__item', i.danger && 'menu__item--danger')}
                  role="menuitem"
                  autoFocus={idx === 0}
                  onClick={() => {
                    pop.close();
                    i.onSelect();
                  }}
                >
                  {i.icon}
                  {i.label}
                </button>
              </div>
            ))}
        </div>
      </Popover>
    </>
  );
}

/* ── Toasts ── */
export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return createPortal(
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <GlassSurface key={t.id} radius={14} tone="sheet" className={cn('toast', `toast--${t.tone}`)} role="status">
          <span className="toast__icon">{t.tone === 'success' ? <Check /> : t.tone === 'error' ? <AlertTriangle /> : <Info />}</span>
          <div className="grow">
            <div className="toast__title">{t.title}</div>
            {t.description && <div className="toast__desc">{t.description}</div>}
          </div>
          {t.action && (
            <Button
              size="sm"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </Button>
          )}
          <button className="btn btn--ghost btn--sm btn--icon" onClick={() => dismissToast(t.id)} aria-label={$t("Dismiss")} style={{ ['--btn-h' as string]: '24px' }}>
            <X />
          </button>
        </GlassSurface>
      ))}
    </div>,
    document.body,
  );
}

/* ── Confirmation dialog (promise based, see confirmDialog in lib/ui) ── */
export function ConfirmHost() {
  const c = useUI((s) => s.confirm);
  return (
    <Modal
      open={!!c}
      onClose={() => c?.resolve(false)}
      title={c?.title ?? ''}
      description={c?.description}
      size="sm"
      initialFocus={false}
      footer={
        <>
          <Button onClick={() => c?.resolve(false)}>{c?.cancelLabel ?? $t("Cancel")}</Button>
          <Button variant={c?.tone === 'default' ? 'primary' : 'danger'} onClick={() => c?.resolve(true)} data-autofocus autoFocus>
            {c?.confirmLabel ?? $t("Delete")}
          </Button>
        </>
      }
    >
      <div className="row gap-12" style={{ color: 'var(--text-3)', fontSize: 13 }}>
        {c?.tone !== 'default' && <AlertTriangle size={16} color="var(--danger)" />}
        {c?.tone !== 'default' ? $t("This cannot be undone.") : $t("You can change this later.")}
      </div>
    </Modal>
  );
}

/* ── Empty state ── */
export function EmptyState({
  icon,
  title,
  text,
  actions,
  compact,
}: {
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('empty', compact && 'empty--compact')}>
      <div className="empty__icon">{icon}</div>
      <div className="empty__title">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number | string; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}
