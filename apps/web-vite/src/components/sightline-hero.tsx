'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from '@tanstack/react-router';
import {
  attachScrollTrigger,
  ensureScrollTrigger,
} from 'kinetrell/web/gsap';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { createKinetrellLenis } from 'kinetrell/web/lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { GridScene, Heading, Text } from '@acme/ui';
import { Section, View } from '@acme/ui/tw';
import { SightlineHeroCanvas } from '@acme/spatial/sightline';

export function SightlineHero() {
  const rootRef = useRef<HTMLElement | null>(null);
  const copyRef = useRef<HTMLElement | null>(null);
  const productRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef(0);
  const reducedMotion = useBrowserReducedMotion('system');

  useEffect(() => {
    const root = rootRef.current;
    const copy = copyRef.current;
    const product = productRef.current;
    if (!root || !copy || !product || !ensureScrollTrigger()) return;

    if (reducedMotion) {
      progressRef.current = 0.55;
      gsap.set([copy, product], { clearProps: 'transform,opacity' });
      return;
    }

    const owned = createKinetrellLenis({
      autoRaf: false,
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.92,
    });
    const disconnect = connectGsapLenis(owned.lenis, {
      clock: 'kinetrell',
      refreshOnConnect: true,
    });

    const timeline = gsap.timeline({ paused: true });
    timeline.fromTo(
      copy,
      { y: 0, opacity: 1 },
      { y: -72, opacity: 0.78, ease: 'none', duration: 1 },
      0,
    );
    timeline.fromTo(
      product,
      { y: 64, scale: 0.94 },
      { y: -28, scale: 1.035, ease: 'none', duration: 1 },
      0,
    );
    timeline.eventCallback('onUpdate', () => {
      progressRef.current = timeline.progress();
    });

    const trigger = attachScrollTrigger(timeline, {
      trigger: root,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.8,
    });

    return () => {
      trigger.kill();
      timeline.kill();
      disconnect();
      owned.destroy();
    };
  }, [reducedMotion]);

  return (
    <View
      ref={rootRef as never}
      className="relative min-h-[132vh] overflow-hidden border-b border-border bg-surface"
    >
      <View className="absolute inset-0 opacity-75">
        <GridScene
          className="flex-1"
          horizon={0.56}
          gap={0}
          speed={0.2}
          lineColor="#A9B4AE"
          glowColor="#0E8FA3"
          backgroundColor="#EEF0EC"
          opacity={0.3}
          showCeiling={false}
        />
      </View>

      <Section className="sticky top-0 mx-auto min-h-screen w-full max-w-screen-2xl px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
        <View className="grid min-h-[78vh] grid-cols-1 items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-5">
          <View ref={copyRef as never} className="z-10 max-w-2xl gap-5">
            <Text className="self-start rounded-full border border-border bg-surface-raised/90 px-3 py-1.5 text-xs font-semibold text-text-muted shadow-card">
              Harlem in your sightline
            </Text>
            <Heading
              level={1}
              size="display-2xl"
              className="max-w-3xl tracking-[-0.045em] text-text"
            >
              See the block. Know the story.
            </Heading>
            <Text className="max-w-2xl text-base leading-7 text-text-muted md:text-xl md:leading-9">
              Find the place, understand why it matters, then carry the route from
              the map into spatial navigation without losing the Harlem around it.
            </Text>

            <View className="mt-2 flex-row flex-wrap gap-3">
              <Link
                to="/explore"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-card transition-colors duration-150 hover:bg-primary-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
              >
                Explore Harlem
              </Link>
              <Link
                to="/ar"
                className="rounded-lg border border-border-strong bg-surface-raised px-5 py-3 text-sm font-semibold text-text shadow-card transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
              >
                See the AR experience
              </Link>
            </View>

            <View className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <View className="rounded-xl border border-border bg-surface-raised/90 p-3 shadow-card">
                <Text className="text-xs font-semibold text-primary">01 · DISCOVER</Text>
                <Text className="mt-1 text-sm text-text-muted">Local places + context</Text>
              </View>
              <View className="rounded-xl border border-border bg-surface-raised/90 p-3 shadow-card">
                <Text className="text-xs font-semibold text-primary">02 · WALK</Text>
                <Text className="mt-1 text-sm text-text-muted">Entrance-aware routes</Text>
              </View>
              <View className="col-span-2 rounded-xl border border-border bg-surface-raised/90 p-3 shadow-card sm:col-span-1">
                <Text className="text-xs font-semibold text-primary">03 · LOOK UP</Text>
                <Text className="mt-1 text-sm text-text-muted">AR stories in place</Text>
              </View>
            </View>

            <Text className="pt-2 text-xs text-text-muted">
              Built from Harlem Mights’ first-party catalogue, verified sources and
              reusable spatial anchors.
            </Text>
          </View>

          <View
            ref={productRef as never}
            className="relative min-h-[390px] overflow-hidden rounded-[28px] border border-border bg-surface-raised/55 shadow-raised backdrop-blur-sm sm:min-h-[520px] lg:min-h-[650px]"
          >
            <SightlineHeroCanvas
              getProgress={() => progressRef.current}
              reducedMotion={reducedMotion}
              className="absolute inset-0 h-full w-full"
            />

            <View
              pointerEvents="none"
              className="absolute left-4 top-4 rounded-full border border-border bg-surface-raised/90 px-3 py-1.5 shadow-card"
            >
              <Text className="text-xs font-semibold text-text">
                Mights Sightline · concept hardware
              </Text>
            </View>

            <View
              pointerEvents="none"
              className="absolute bottom-4 left-4 right-4 gap-1 rounded-xl border border-border bg-surface-raised/92 p-4 shadow-card"
            >
              <Text className="text-xs font-semibold text-primary">
                Spatial route preview
              </Text>
              <Text className="text-sm text-text">
                125th St → Apollo Theater · entrance anchor
              </Text>
              <Text className="text-xs text-text-muted">
                Mapbox route → Nitro Mapbox AR → Viro scene → Rive Mights Panel
              </Text>
            </View>
          </View>
        </View>
      </Section>
    </View>
  );
}
