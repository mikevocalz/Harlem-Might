'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { MightsAccentFrame, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { useSightlineIsland, type SightlinePhase } from './sightline-island.store';

// three/webgpu + TypeGPU load only when the band nears the viewport on a
// browser with navigator.gpu. The chunk is never in the route's initial JS
// and the canvas is never the LCP element (ADR 0004).
const SightlineHeroCanvas = dynamic(
  () => import('@acme/spatial/sightline').then((m) => m.SightlineHeroCanvas),
  { ssr: false },
);

const LABEL = 'Concept render of Sightline: slim glasses and a separate compute puck, with a walking route and place markers';

const REDUCE = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (onChange: () => void) => {
  const media = window.matchMedia(REDUCE);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};
const readReduced = () => window.matchMedia(REDUCE).matches;
const serverReduced = () => false;

// Text that stands in for the render. The first sentence is the same
// description the canvas announces; the second says why there is no picture.
const fallbackNote: Record<Exclude<SightlinePhase, 'ready'>, string> = {
  waiting: 'It draws here in browsers that support WebGPU.',
  loading: 'Loading the render.',
  unsupported: 'This browser doesn’t support WebGPU, so the render isn’t shown. Nothing else on this page needs it.',
  failed: 'The render couldn’t start on this device, so it isn’t shown. Nothing else on this page needs it.',
};

export function SightlineIsland() {
  const frameRef = useRef<HTMLDivElement>(null);
  const phase = useSightlineIsland((s) => s.phase);
  const setPhase = useSightlineIsland((s) => s.setPhase);
  const reducedMotion = useSyncExternalStore(subscribeReduced, readReduced, serverReduced);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (!('gpu' in navigator) || !navigator.gpu) {
      setPhase('unsupported');
      return () => setPhase('waiting');
    }
    // Start the download a little before the band scrolls in so the first
    // frame is usually ready by the time it is visible.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setPhase('loading');
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(frame);
    return () => {
      observer.disconnect();
      setPhase('waiting');
    };
  }, [setPhase]);

  // One normalized value: 0 as the band's top enters the bottom of the
  // viewport, 1 as its bottom leaves the top. Read from layout inside the
  // render loop, so scrolling never re-renders React. Stable identity: the
  // canvas rebuilds its GPU device when this function changes.
  const getProgress = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return 0;
    const rect = frame.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
  }, []);

  const onReady = useCallback(() => setPhase('ready'), [setPhase]);
  const onUnavailable = useCallback(() => setPhase('failed'), [setPhase]);

  const mounted = phase === 'loading' || phase === 'ready';
  // Space for the render is reserved until we know it can't draw; then the
  // box shrinks to its text. That happens on hydration, below the fold.
  const box =
    phase === 'unsupported' || phase === 'failed'
      ? 'relative overflow-hidden bg-surface-sunken'
      : 'relative aspect-4/3 overflow-hidden bg-surface-sunken md:aspect-video';

  return (
    <figure className="flex flex-col gap-3">
      <MightsAccentFrame tone="iron" className="p-3">
        <div ref={frameRef} className={box}>
          {mounted ? (
            <SightlineHeroCanvas
              getProgress={getProgress}
              reducedMotion={reducedMotion}
              ariaLabel={LABEL}
              onReady={onReady}
              onUnavailable={onUnavailable}
              className={`absolute inset-0 block h-full w-full transition-opacity duration-slow motion-reduce:transition-none ${
                phase === 'ready' ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : null}
          {phase === 'ready' ? null : (
            <View className={`flex flex-col justify-end gap-2 p-5 md:p-8 ${mounted || phase === 'waiting' ? 'absolute inset-0' : ''}`}>
              <MightsText tone="default">{LABEL}.</MightsText>
              <MightsText size="small">
                {fallbackNote[phase]}
              </MightsText>
            </View>
          )}
        </div>
      </MightsAccentFrame>
      <figcaption className="text-label text-text-muted">
        Concept render. The glasses and puck don’t exist; nobody can buy them and we haven’t built for them.
      </figcaption>
    </figure>
  );
}
