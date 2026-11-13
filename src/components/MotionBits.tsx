import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * A number that eases to its value. The value is a MotionValue written straight to the DOM, so a count
 * does not re-render React on every frame. Reduced motion shows the value at once, and the first
 * render always shows `from` (when given) or the value itself, so there is never a flash of a wrong number.
 */
export function AnimatedNumber({ value, from, duration = 0.4, className }: { value: number; from?: number; duration?: number; className?: string }) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : from ?? value);
  const rounded = useTransform(() => Math.round(motionValue.get()));
  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, reduced, duration, motionValue]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

/** A small number that drops in when it changes, so a count that moves by one is noticed. */
export function Tick({ value, className }: { value: number | string; className?: string }) {
  // The first value is shown as it is; a later change remounts the span (new key) so it drops in.
  const [firstValue] = useState(value);
  return (
    <motion.span key={value} className={`tick${className ? ` ${className}` : ''}`}
      initial={value === firstValue ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut' }}>
      {value}
    </motion.span>
  );
}

/**
 * A match score as a number and a bar that fill to the real value. The bar uses scaleX (a transform) and the
 * score is always in the text, so nothing depends on the bar.
 */
export function ScoreMeter({ score, animateIn, delay = 0 }: { score: number; animateIn: boolean; delay?: number }) {
  return (
    <span className="match-score">
      <span className="score-track" aria-hidden="true">
        <motion.span className="score-fill" style={{ originX: 0 }} initial={animateIn ? { scaleX: 0 } : false}
          animate={{ scaleX: Math.max(0, Math.min(100, score)) / 100 }} transition={{ duration: 0.4, delay, ease: 'easeOut' }} />
      </span>
      <span>{animateIn ? <DelayedNumber value={score} delay={delay} /> : score}%</span>
    </span>
  );
}

/** Counts from 0 to `value` after `delay` seconds. */
function DelayedNumber({ value, delay }: { value: number; delay: number }) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : 0);
  const rounded = useTransform(() => Math.round(motionValue.get()));
  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.4, delay, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, delay, reduced, motionValue]);
  return <motion.span>{rounded}</motion.span>;
}
