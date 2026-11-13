import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

interface DrawerShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerBadge?: ReactNode;
  widthClass?: string;
  children: ReactNode;
}

const SLIDE_EASE = [0.22, 1, 0.36, 1] as const;

interface ActiveDialogProps {
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerBadge?: ReactNode;
  widthClass: string;
  children: ReactNode;
}

function ActiveDialog({
  onClose,
  title,
  subtitle,
  headerBadge,
  widthClass,
  children,
}: ActiveDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pressedOutsideRef = useRef(false);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) {
      return;
    }
    dialog.showModal();
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  const isOutsideSheet = (clientX: number, clientY: number): boolean => {
    const sheet = sheetRef.current;
    if (!sheet) {
      return false;
    }
    const rect = sheet.getBoundingClientRect();
    return (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="cdp-drawer-dialog"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        pressedOutsideRef.current = isOutsideSheet(
          event.clientX,
          event.clientY,
        );
      }}
      onPointerUp={(event) => {
        if (
          pressedOutsideRef.current &&
          isOutsideSheet(event.clientX, event.clientY)
        ) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
    >
      <div className="relative flex h-full w-full justify-end">
        <motion.div
          aria-hidden="true"
          className="fixed inset-0 bg-zinc-950/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: SLIDE_EASE }}
        />

        <motion.div
          ref={sheetRef}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.28, ease: SLIDE_EASE }}
          className={`relative z-10 flex h-full w-full ${widthClass} flex-col border-l border-border-subtle bg-surface shadow-[0_8px_32px_rgba(9,9,11,0.12)]`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border-subtle bg-surface px-6 py-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={headingId}
                  className="text-base font-semibold tracking-tight text-ink-primary"
                >
                  {title}
                </h2>
                {headerBadge}
              </div>
              {subtitle ? (
                <p className="text-xs leading-relaxed text-ink-secondary font-thai">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <motion.button
              type="button"
              autoFocus
              whileTap={{ scale: 0.985 }}
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </motion.button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </motion.div>
      </div>
    </dialog>
  );
}

export function DrawerShell({
  open,
  onClose,
  title,
  subtitle,
  headerBadge,
  widthClass = 'max-w-2xl',
  children,
}: DrawerShellProps) {
  return (
    <AnimatePresence>
      {open ? (
        <ActiveDialog
          onClose={onClose}
          title={title}
          subtitle={subtitle}
          headerBadge={headerBadge}
          widthClass={widthClass}
        >
          {children}
        </ActiveDialog>
      ) : null}
    </AnimatePresence>
  );
}
