import { motion, useReducedMotion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

interface CoachTargetProps {
  /** While true the child pulses once or twice and a short note points at it. */
  active: boolean;
  title: string;
  /** The note body; plain sentences, it can use <strong> to name the button it points at. */
  children: ReactNode;
  /** The element the note points at. */
  target: ReactNode;
  onDone: () => void;
}

/**
 * A one-off nudge, in the same voice as the AI switch note: the target gives a short zoom and a ring, and a note
 * points at it. It never blocks the page or takes focus, and it goes away on "เข้าใจแล้ว", on Escape, or when
 * the caller sets `active` to false (for example because the user did what the note asked).
 */
export function CoachTarget({ active, title, children, target, onDone }: CoachTargetProps) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Bring the target into view first, otherwise the note appears where nobody is looking.
    const rect = wrap.getBoundingClientRect();
    if (rect.top < 220 || rect.bottom > window.innerHeight - 40) {
      wrap.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    }
    const place = () => {
      const tip = tipRef.current;
      if (tip) tip.style.setProperty('--target-w', `${wrap.offsetWidth}px`);
    };
    place();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone();
    };
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey);
    };
  }, [active, onDone, reduced]);

  return (
    <motion.span ref={wrapRef} className="ai-mode-wrap coach-wrap" animate={active && !reduced ? { scale: [1, 1.1, 1] } : { scale: 1 }} transition={{ duration: 0.6, ease: 'easeInOut', delay: 0.5 }}>
      {active && !reduced && (
        <motion.span className="ai-ring" aria-hidden="true" initial={{ opacity: 0.8, scale: 1 }} animate={{ opacity: 0, scale: 1.3 }} transition={{ duration: 1.1, repeat: 2, ease: 'easeOut', delay: 0.5 }} />
      )}
      {target}
      {/* No AnimatePresence here: this sits inside a list row that has its own exit animation, and a nested one would keep that row on screen. */}
      {active && (
        <motion.div ref={tipRef} className="ai-tip coach-tip" role="region" aria-label={title}
          initial={reduced ? false : { opacity: 0, scale: 0.92, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut', delay: reduced ? 0 : 0.35 }}>
          <p className="ai-tip-title"><Sparkles size={16} aria-hidden="true" /> {title}</p>
          <p>{children}</p>
          <div className="ai-tip-actions">
            <button type="button" className="button button-primary" onClick={onDone}>เข้าใจแล้ว</button>
          </div>
        </motion.div>
      )}
    </motion.span>
  );
}
