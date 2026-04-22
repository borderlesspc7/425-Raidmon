import { useEffect, useRef, useState } from 'react';

type UseCountUpOptions = {
  durationMs?: number;
};

const DEFAULT_DURATION_MS = 1400;

export function useCountUp(targetValue: number, options?: UseCountUpOptions): number {
  const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
  const sanitizedTarget = Number.isFinite(targetValue) ? targetValue : 0;

  const [currentValue, setCurrentValue] = useState(sanitizedTarget);
  const previousTargetRef = useRef(sanitizedTarget);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const startValue = previousTargetRef.current;
    const endValue = sanitizedTarget;

    if (durationMs <= 0 || startValue === endValue) {
      previousTargetRef.current = endValue;
      setCurrentValue(endValue);
      return;
    }

    const startAt = Date.now();

    const step = () => {
      const elapsed = Date.now() - startAt;
      const progress = Math.min(elapsed / durationMs, 1);
      // easeOutCubic: sobe rapido no inicio e desacelera perto do valor final.
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (endValue - startValue) * easedProgress;

      setCurrentValue(nextValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        previousTargetRef.current = endValue;
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [durationMs, sanitizedTarget]);

  return currentValue;
}
