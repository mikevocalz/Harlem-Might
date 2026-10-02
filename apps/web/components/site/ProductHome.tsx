'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from 'solito/link';
import {
  attachScrollTrigger,
  ensureScrollTrigger,
} from 'kinetrell/web/gsap';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { GridScene, Heading, Text } from '@acme/ui';
import { Section, View } from '@acme/ui/tw';
import { SightlineHeroCanvas } from '@acme/spatial/sightline';

const CHAPTERS = [
  {
    eyebrow: '01 / DISCOVER',
    title: 'Start with the block, not the search box.',
    body: 'Harlem Might keeps places, people, history and neighborhood context connected to the map instead of flattening them into disconnected listings.',
  },
  {
    eyebrow: '02 / WALK',
    title: 'Move through Harlem with the story still attached.',
    body: 'Routes become a narrative layer: entrances, nearby places, landmarks and context stay visible as you move.',
  },
  {
    eyebrow: '03 / LOOK UP',
    title: 'Turn the same corner into another time.',
    body: 'Spatial and AR layers connect archival material, stories and landmarks to the exact place where they matter.',
  },
] as const;

const FEATURES = [
  ['Explore', 'Map-first discovery with place detail, saved places and context that survives across views.'],
  ['Mights', 'Local intelligence panels that keep the useful detail close without burying the map.'],
  ['Spatial', 'A path from screen to AR and XR using the same place identity and route context.'],
  ['Stories', 'Editorial and archival layers that explain why a place matters, not just where it is.'],
] as const;

export function ProductHome() {
  const heroRef = useRef<HTMLElement | null>(null);
  const copyRef = useRef<HTMLElement | null>(null);
  const productRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef(0);
  const reducedMotion = useBrowserReducedMotion('system');

  useEffect(() => {
    const hero = heroRef.current;
    const copy = copyRef.current;
    const product = productRef.current;
    if (!hero || !copy || !product || !ensureScrollTrigger()) return;

    if (reducedMotion) {
      progressRef.current = 0.55;
      gsap.set([copy, product], { clearProps: 'transform,opacity' });
      return;
    }

    const timeline = gsap.timeline({ paused: true });
    timeline.fromTo(
      copy,
      { y: 0, opacity: 1 },
      { y: -78, opacity: 0.76, ease: 'none', duration: 1 },
      0,
    );
    timeline.fromTo(
      product,
      { y: 70, scale: 0.935 },
      { y: -30, scale: 1.04, ease: 'none', duration: 1 },
      0,
    );
    timeline.eventCallback('onUpdate', () => {
      progressRef.current = timeline.progress();
    });

    const trigger = attachScrollTrigger(timeline, {
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.8,
    });

    return () => {
      trigger.kill();
      timeline.kill();
    };
  }, [reducedMotion]);

  return (
    <View className="bg-[#050505]">
      <View
        ref={heroRef as never}
        className="relative min-h-[138vh] overflow-hidden border-b border-cyan-400/20 bg-[#050505]"
      >
        <View className="absolute inset-0 opacity-80">
          <GridScene
            className="flex-1"
            horizon={0.56}
            gap={0}
            speed={0.2}
            lineColor="#00f3ff"
            glowColor="#00f3ff"
            backgroundColor="#050505"
            opacity={0.26}
            showCeiling={false}
          />
        </View>

        <Section className="sticky top-0 mx-auto min-h-screen w-full max-w-screen-2xl px-4 py-20 sm:px-6 lg:py-24">
          <View className="grid min-h-[80vh] grid-cols-1 items-center gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:gap-4">
            <View ref={copyRef as never} className="z-10 max-w-2xl gap-5">
              <Text className="self-start rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                Harlem in your sightline
              </Text>
              <Heading
                level={1}
                size="display-2xl"
                className="max-w-3xl tracking-[-0.045em] text-white"
              >
                See the block. Know the story.
              </Heading>
              <Text className="max-w-2xl text-base leading-7 text-cyan-50/65 md:text-xl md:leading-9">
                Explore Harlem as a living spatial guide — places, culture, food,
                history, routes and AR context connected to the neighborhood instead
                of scattered across a dozen apps.
              </Text>

              <View className="mt-2 flex-row flex-wrap gap-3">
                <Link
                  href="/explore"
                  className="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-bold text-[#041013] shadow-[0_0_26px_rgba(0,243,255,0.2)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  Explore Harlem
                </Link>
                <Link
                  href="/spatial"
                  className="rounded-lg border border-cyan-400/30 bg-black/45 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                >
                  Enter spatial view
                </Link>
              </View>

              <View className="mt-4 grid grid-cols-3 gap-2">
                {['Places', 'Stories', 'Spatial'].map((label, index) => (
                  <View
                    key={label}
                    className="rounded-xl border border-cyan-400/15 bg-black/35 p-3 backdrop-blur-sm"
                  >
                    <Text className="text-[10px] font-semibold tabular-nums text-cyan-400">
                      0{index + 1}
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-cyan-50">{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              ref={productRef as never}
              className="relative min-h-[430px] overflow-hidden rounded-[30px] border border-cyan-400/25 bg-black/35 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:min-h-[560px] lg:min-h-[680px]"
            >
              <SightlineHeroCanvas
                getProgress={() => progressRef.current}
                reducedMotion={reducedMotion}
                className="absolute inset-0 h-full w-full"
              />
              <View
                pointerEvents="none"
                className="absolute left-4 top-4 rounded-full border border-cyan-400/25 bg-black/65 px-3 py-1.5 backdrop-blur-md"
              >
                <Text className="text-xs font-semibold text-cyan-100">
                  Mights Sightline
                </Text>
              </View>
              <View
                pointerEvents="none"
                className="absolute bottom-4 left-4 right-4 gap-1 rounded-xl border border-cyan-400/20 bg-black/70 p-4 backdrop-blur-md"
              >
                <Text className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                  Spatial route preview
                </Text>
                <Text className="text-sm font-semibold text-white">
                  125th St → Apollo Theater
                </Text>
                <Text className="text-xs text-cyan-50/55">
                  Place context → route → entrance → spatial story
                </Text>
              </View>
            </View>
          </View>
        </Section>
      </View>

      <Section
        data-motion-section
        className="mx-auto w-full max-w-screen-2xl gap-8 px-4 py-20 sm:px-6 md:py-28"
      >
        <View className="max-w-3xl gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            One neighborhood / many layers
          </Text>
          <Heading level={2} size="display-sm" className="text-white">
            The map is only the beginning.
          </Heading>
          <Text className="text-base leading-7 text-cyan-50/55">
            Harlem Might moves from discovery to context to movement without dropping
            the identity of the place along the way.
          </Text>
        </View>

        <View className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CHAPTERS.map((chapter) => (
            <View
              key={chapter.title}
              className="min-h-72 gap-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.035] p-6"
            >
              <Text className="text-xs font-semibold tracking-[0.16em] text-cyan-300">
                {chapter.eyebrow}
              </Text>
              <Heading level={3} size="title" className="text-white">
                {chapter.title}
              </Heading>
              <Text className="text-sm leading-6 text-cyan-50/55 md:text-base md:leading-7">
                {chapter.body}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section
        data-motion-section
        className="border-y border-cyan-400/15 bg-cyan-400/[0.025]"
      >
        <View className="mx-auto w-full max-w-screen-2xl gap-8 px-4 py-20 sm:px-6 md:py-28">
          <View className="max-w-3xl gap-3">
            <Text className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Product system
            </Text>
            <Heading level={2} size="display-sm" className="text-white">
              One place identity across every screen.
            </Heading>
          </View>
          <View className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-cyan-400/15 bg-cyan-400/15 md:grid-cols-2">
            {FEATURES.map(([title, body]) => (
              <View key={title} className="min-h-52 gap-3 bg-[#070909] p-6 md:p-8">
                <Text className="text-lg font-semibold text-cyan-100">{title}</Text>
                <Text className="max-w-xl text-sm leading-6 text-cyan-50/50 md:text-base md:leading-7">
                  {body}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Section>

      <Section
        data-motion-section
        className="mx-auto w-full max-w-screen-2xl px-4 py-20 sm:px-6 md:py-28"
      >
        <View className="items-start gap-5 rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(0,243,255,0.09),rgba(0,0,0,0.3))] p-7 md:p-10">
          <Text className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Start here
          </Text>
          <Heading level={2} size="display-sm" className="max-w-4xl text-white">
            Pick a place. Then keep going.
          </Heading>
          <Text className="max-w-3xl text-base leading-7 text-cyan-50/55">
            Open the map, select a Harlem place, and move from discovery into detail,
            saved context and spatial navigation without leaving the product.
          </Text>
          <Link
            href="/explore"
            className="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-bold text-[#041013] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            Open Explore
          </Link>
        </View>
      </Section>
    </View>
  );
}
