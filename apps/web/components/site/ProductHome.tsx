'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from 'solito/link';
import { attachScrollTrigger, ensureScrollTrigger } from 'kinetrell/web/gsap';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { Card, GridScene, Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';
import { SightlineHeroCanvas } from '@acme/spatial/sightline';

const CHAPTERS = [
  {
    number: '01',
    eyebrow: 'Discover',
    title: 'Start with a block.',
    body: 'Search a place, move the map, and keep the story, source and real entrance attached to the same canonical location.',
  },
  {
    number: '02',
    eyebrow: 'Walk',
    title: 'Carry context with you.',
    body: 'Turn a saved place into an entrance-aware route without collapsing Harlem into a generic directions screen.',
  },
  {
    number: '03',
    eyebrow: 'Look up',
    title: 'The history is already there.',
    body: 'Move from the map into spatial layers and AR stories that belong to the exact corner where they happened.',
  },
] as const;

export function ProductHome() {
  const heroRef = useRef<HTMLElement | null>(null);
  const heroCopyRef = useRef<HTMLElement | null>(null);
  const heroObjectRef = useRef<HTMLElement | null>(null);
  const storyRef = useRef<HTMLElement | null>(null);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const progressRef = useRef(0);
  const reducedMotion = useBrowserReducedMotion('system');

  useEffect(() => {
    const hero = heroRef.current;
    const copy = heroCopyRef.current;
    const object = heroObjectRef.current;
    if (!hero || !copy || !object || reducedMotion || !ensureScrollTrigger()) {
      progressRef.current = reducedMotion ? 0.55 : 0;
      return;
    }

    const timeline = gsap.timeline({ paused: true });
    timeline.fromTo(
      copy,
      { y: 0, autoAlpha: 1 },
      { y: -74, autoAlpha: 0.76, ease: 'none', duration: 1 },
      0,
    );
    timeline.fromTo(
      object,
      { y: 70, scale: 0.945 },
      { y: -26, scale: 1.035, ease: 'none', duration: 1 },
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

  useEffect(() => {
    const story = storyRef.current;
    const chapters = chapterRefs.current.filter(Boolean);
    if (!story || chapters.length === 0 || reducedMotion || !ensureScrollTrigger()) return;

    const timeline = gsap.timeline({ paused: true });
    timeline.fromTo(
      chapters,
      { y: 54, autoAlpha: 0.35 },
      {
        y: 0,
        autoAlpha: 1,
        stagger: 0.16,
        duration: 1,
        ease: 'power2.out',
      },
    );

    const trigger = attachScrollTrigger(timeline, {
      trigger: story,
      start: 'top 84%',
      end: 'top 38%',
      scrub: 0.7,
    });

    return () => {
      trigger.kill();
      timeline.kill();
    };
  }, [reducedMotion]);

  return (
    <Main className="flex-1 overflow-hidden bg-surface">
      <View
        ref={heroRef as never}
        className="relative min-h-[138vh] overflow-hidden border-b border-border bg-surface"
      >
        <View className="absolute inset-0 opacity-80">
          <GridScene
            className="flex-1"
            horizon={0.57}
            gap={0}
            speed={0.18}
            lineColor="#A9B4AE"
            glowColor="#0E8FA3"
            backgroundColor="#EEF0EC"
            opacity={0.27}
            showCeiling={false}
          />
        </View>

        <Section className="sticky top-0 mx-auto min-h-screen w-full max-w-screen-2xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <View className="grid min-h-[80vh] grid-cols-1 items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-6">
            <View ref={heroCopyRef as never} className="z-10 max-w-2xl gap-5">
              <Text className="self-start rounded-full border border-border bg-surface-raised/90 px-3 py-1.5 text-xs font-semibold text-primary shadow-card">
                Harlem in your sightline
              </Text>

              <Heading
                level={1}
                size="display-2xl"
                className="max-w-3xl tracking-[-0.05em] text-text"
              >
                See the block. Know the story.
              </Heading>

              <Text className="max-w-2xl text-base leading-7 text-text-muted md:text-xl md:leading-9">
                Harlem Might connects places, local context, walking routes and spatial
                stories so discovery never loses the neighborhood around it.
              </Text>

              <View className="mt-2 flex-row flex-wrap gap-3">
                <Link
                  href="/explore"
                  className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-card transition-colors duration-200 hover:bg-primary-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
                >
                  Explore Harlem
                </Link>
                <Link
                  href="/spatial"
                  className="rounded-xl border border-border-strong bg-surface-raised px-5 py-3 text-sm font-semibold text-text shadow-card transition-colors duration-200 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
                >
                  Enter the spatial experience
                </Link>
              </View>

              <View className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {['Places + context', 'Entrance-aware routes', 'Spatial stories'].map(
                  (label, index) => (
                    <View
                      key={label}
                      className={`rounded-xl border border-border bg-surface-raised/88 p-3 shadow-card ${
                        index === 2 ? 'col-span-2 sm:col-span-1' : ''
                      }`}
                    >
                      <Text className="text-[11px] font-semibold tabular-nums text-primary">
                        0{index + 1}
                      </Text>
                      <Text className="mt-1 text-sm text-text-muted">{label}</Text>
                    </View>
                  ),
                )}
              </View>
            </View>

            <View
              ref={heroObjectRef as never}
              className="relative min-h-[410px] overflow-hidden rounded-[30px] border border-border bg-surface-raised/58 shadow-raised backdrop-blur-sm sm:min-h-[540px] lg:min-h-[660px]"
            >
              <SightlineHeroCanvas
                getProgress={() => progressRef.current}
                reducedMotion={reducedMotion}
                className="absolute inset-0 h-full w-full"
              />

              <View
                pointerEvents="none"
                className="absolute left-4 top-4 rounded-full border border-border bg-surface-raised/92 px-3 py-1.5 shadow-card"
              >
                <Text className="text-xs font-semibold text-text">
                  Mights Sightline · spatial preview
                </Text>
              </View>

              <View
                pointerEvents="none"
                className="absolute bottom-4 left-4 right-4 gap-1 rounded-2xl border border-border bg-surface-raised/94 p-4 shadow-card"
              >
                <Text className="text-xs font-semibold text-primary">Route in context</Text>
                <Text className="text-sm font-medium text-text">
                  125th St → Apollo Theater
                </Text>
                <Text className="text-xs leading-5 text-text-muted">
                  Place record → entrance anchor → walking route → spatial story
                </Text>
              </View>
            </View>
          </View>
        </Section>
      </View>

      <Section
        ref={storyRef as never}
        className="mx-auto w-full max-w-screen-2xl gap-8 px-4 py-20 sm:px-6 md:py-28"
      >
        <View className="max-w-3xl gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            One continuous experience
          </Text>
          <Heading level={2} size="display-sm" className="tracking-[-0.035em] text-text">
            From discovery to the street without dropping the context.
          </Heading>
          <Text className="text-base leading-7 text-text-muted">
            The product site, map workspace and spatial view now share the same visual
            and motion language instead of feeling like separate demos.
          </Text>
        </View>

        <View className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CHAPTERS.map((chapter, index) => (
            <View
              key={chapter.number}
              ref={((node: HTMLElement | null) => {
                chapterRefs.current[index] = node;
              }) as never}
              className="min-w-0"
            >
              <Card
                elevation={index === 1 ? 'raised' : 'flat'}
                className="min-h-72 gap-4 border-border bg-surface-raised p-6"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    {chapter.eyebrow}
                  </Text>
                  <Text className="text-xs font-semibold tabular-nums text-text-muted">
                    {chapter.number}
                  </Text>
                </View>
                <Heading level={3} size="title" className="text-text">
                  {chapter.title}
                </Heading>
                <Text className="text-sm leading-6 text-text-muted md:text-base md:leading-7">
                  {chapter.body}
                </Text>
              </Card>
            </View>
          ))}
        </View>
      </Section>

      <Section className="border-y border-border bg-surface-raised">
        <View className="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between md:py-24">
          <View className="max-w-3xl gap-3">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Harlem Might
            </Text>
            <Heading level={2} size="display-sm" className="tracking-[-0.035em] text-text">
              The map is the beginning, not the product boundary.
            </Heading>
            <Text className="text-base leading-7 text-text-muted">
              Save places, plan time, open the spatial view and return to the same
              canonical Harlem record everywhere.
            </Text>
          </View>
          <Link
            href="/explore"
            className="self-start rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-card md:self-auto"
          >
            Open Explore
          </Link>
        </View>
      </Section>
    </Main>
  );
}
