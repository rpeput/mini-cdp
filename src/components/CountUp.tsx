import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Counts from 0 to the value once, over 300ms, when `start` first becomes true. Reduced motion shows
 * the final number at once, and the final number is always in the accessible name.
 */
export function CountUp({ value, start = true }: { value: number; start?: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const played = useRef(false);
  useEffect(() => {
    if (reduced || !start || played.current) return;
    played.current = true;
    const controls = animate(0, value, {
      duration: 0.3,
      ease: 'easeOut',
      onUpdate: (latest) => setShown(Math.round(latest)),
      onComplete: () => setDone(true),
    });
    return () => controls.stop();
  }, [value, reduced, start]);
  return <span aria-label={String(value)}>{reduced || done ? value : shown}</span>;
}
