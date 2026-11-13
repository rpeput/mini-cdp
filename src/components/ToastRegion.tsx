import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ToastItem {
  id: string;
  tone: 'success' | 'warning' | 'info';
  title: string;
  detail?: string;
}

interface ToastRegionProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  suppressed?: boolean;
}

const TOAST_TONE_STYLES: Record<
  ToastItem['tone'],
  { border: string; iconWrap: string }
> = {
  success: {
    border: 'border-emerald-200',
    iconWrap: 'text-status-verified',
  },
  warning: {
    border: 'border-amber-300',
    iconWrap: 'text-brand-amber-hover',
  },
  info: {
    border: 'border-border-subtle',
    iconWrap: 'text-brand-slate',
  },
};

function ToastIcon({ tone }: { tone: ToastItem['tone'] }) {
  const cls = `h-4 w-4 shrink-0 ${TOAST_TONE_STYLES[tone].iconWrap}`;
  if (tone === 'success') {
    return <CheckCircle2 className={cls} aria-hidden="true" />;
  }
  if (tone === 'warning') {
    return <AlertTriangle className={cls} aria-hidden="true" />;
  }
  return <Info className={cls} aria-hidden="true" />;
}

export function ToastRegion({
  toasts,
  onDismiss,
  suppressed = false,
}: ToastRegionProps) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || suppressed || toasts.length === 0) {
      return;
    }
    const oldest = toasts[0];
    const timer = setTimeout(() => {
      onDismiss(oldest.id);
    }, 3200);
    return () => clearTimeout(timer);
  }, [paused, suppressed, toasts, onDismiss]);

  if (suppressed) {
    return (
      <div
        role="region"
        aria-label="การแจ้งเตือน"
        aria-live="polite"
        className="sr-only"
      />
    );
  }

  return (
    <div
      role="region"
      aria-label="การแจ้งเตือน"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex max-w-sm flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${TOAST_TONE_STYLES[toast.tone].border} bg-surface px-4 py-3 shadow-[0_4px_16px_rgba(9,9,11,0.08)]`}
          >
            <div className="pt-0.5">
              <ToastIcon tone={toast.tone} />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-semibold text-ink-primary">
                {toast.title}
              </p>
              {toast.detail ? (
                <p className="text-xs leading-relaxed text-ink-secondary font-thai">
                  {toast.detail}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={`ปิดการแจ้งเตือน ${toast.title}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
