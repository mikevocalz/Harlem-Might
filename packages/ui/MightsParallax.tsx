'use client';

import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { compileMotion, defineMotion, evaluateMotion } from 'kinetrell/core';
import { View } from './tw';

export interface MightsParallaxProps {
  children: ReactNode;
  className?: string;
  distance?: number;
  scaleFrom?: number;
  opacityFrom?: number;
  rangeVh?: number;
}

function subscribe(listener: () => void) {
  if (typeof globalThis.addEventListener !== 'function') return () => {};
  globalThis.addEventListener('scroll', listener, { passive: true });
  globalThis.addEventListener('resize', listener);
  return () => {
    globalThis.removeEventListener('scroll', listener);
    globalThis.removeEventListener('resize', listener);
  };
}

function snapshot() {
  const y = typeof globalThis.scrollY === 'number' ? globalThis.scrollY : 0;
  const h = typeof globalThis.innerHeight === 'number' ? globalThis.innerHeight : 1;
  return `${Math.round(y)}:${Math.round(h)}`;
}

/**
 * Kinetrell-backed scroll choreography behind the universal UI boundary.
 * Feature routes never render animation-library DOM nodes directly.
 */
export function MightsParallax({
  children,
  className,
  distance = 72,
  scaleFrom = 0.965,
  opacityFrom = 0.72,
  rangeVh = 1.1,
}: MightsParallaxProps) {
  const current = useSyncExternalStore(subscribe, snapshot, () => '0:1');

  const motion = useMemo(
    () =>
      compileMotion(
        defineMotion({
          id: 'harlem-mights-parallax',
          initial: {
            hero: { translateY: distance, scale: scaleFrom, opacity: opacityFrom },
          },
          tracks: [
            {
              target: 'hero',
              to: { translateY: 0, scale: 1, opacity: 1 },
              durationMs: 1000,
              ease: 'cubic.out',
            },
          ],
        }),
      ),
    [distance, opacityFrom, scaleFrom],
  );

  const [rawY, rawH] = current.split(':').map(Number);
  const y = Number.isFinite(rawY) ? rawY : 0;
  const h = Math.max(1, Number.isFinite(rawH) ? rawH : 1);
  const progress = Math.min(1, Math.max(0, y / (h * rangeVh)));
  const state = evaluateMotion(motion, progress * motion.durationMs).hero;

  return (
    <View
      className={className}
      style={{
        opacity: Number(state?.opacity ?? 1),
        transform: [
          { translateY: Number(state?.translateY ?? 0) },
          { scale: Number(state?.scale ?? 1) },
        ],
      }}
    >
      {children}
    </View>
  );
}
