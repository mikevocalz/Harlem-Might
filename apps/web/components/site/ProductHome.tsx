"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useBrowserReducedMotion } from "kinetrell/web/react";
import { Main, Section, View } from "@acme/ui/tw";
import {
  MapAttribution,
  MightsAccentFrame,
  cornerCut,
  MightsButton,
  MightsHeading,
  MightsLocationStamp,
  MightsMapImage,
  MightsNotchCard,
  MightsPlaceBento,
  MightsText,
  routes,
} from "@acme/ui/mights";
import { HARLEM_PLACE_PREVIEWS, type HarlemPlacePreview } from "@acme/app/features/explore/explore.store.ts";

type MappedPlace = HarlemPlacePreview & { lngLat: readonly [number, number] };
const MAPPED = HARLEM_PLACE_PREVIEWS.filter((p): p is MappedPlace =>
  Boolean(p.lngLat),
);
const byId = (id: string) => MAPPED.find((p) => p.id === id)!;

const APOLLO = byId("apollo-theater");
const STUDIO = byId("studio-museum-harlem");
const SYLVIAS = byId("sylvias-restaurant");
const BLOCK = [APOLLO, STUDIO, SYLVIAS];

// West 125th Street, between the Apollo and the Studio Museum.
const HERO_CENTER = [
  (APOLLO.lngLat[0] + STUDIO.lngLat[0]) / 2,
  (APOLLO.lngLat[1] + STUDIO.lngLat[1]) / 2,
] as const;

const chapter = "mx-auto w-full max-w-screen-2xl px-4 sm:px-6";

export function ProductHome() {
  const lensRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useBrowserReducedMotion("system");

  // The page's one orchestrated moment: the lens resolves over the block.
  useEffect(() => {
    const lens = lensRef.current;
    if (!lens || reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        lens,
        { autoAlpha: 0, scale: 0.94 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.9,
          ease: "expo.out",
          delay: 0.15,
          clearProps: "transform,opacity,visibility",
        },
      );
    }, lens);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <Main className="-mt-16 flex-1 bg-surface">
      {/* Chapter 1 — the block, through the lens */}
      <Section className="relative grid grid-cols-1 lg:min-h-[100svh] lg:grid-cols-12">
        <View className="z-10 flex flex-col justify-end gap-8 px-4 pb-12 pt-28 sm:px-6 lg:col-span-5 lg:pb-20 lg:pl-[max(1.5rem,calc((100vw-96rem)/2+1.5rem))]">
          <MightsHeading level={1} size="marquee">
            See the block. Know the story.
          </MightsHeading>
          <MightsText size="lead" className="max-w-[34ch]">
            Places, walks and the history attached to each corner of Harlem, on
            one map.
          </MightsText>
          <View className="flex-row">
            <MightsButton href={routes.explore()}>Open the map</MightsButton>
          </View>
        </View>

        <View className="relative h-[560px] overflow-hidden border-t border-rule-hairline lg:col-span-7 lg:h-auto lg:min-h-[100svh] lg:border-l lg:border-t-0">
          <View className="absolute inset-0">
            <MightsMapImage
              center={HERO_CENTER}
              zoom={16.2}
              pitch={50}
              bearing={-29}
              width={1280}
              height={960}
              alt="Map of West 125th Street in Harlem, from the Apollo Theater to the Studio Museum"
              priority
            />
          </View>

          <View className="pointer-events-none absolute inset-0 items-center justify-center">
            <View
              ref={lensRef as never}
              className="pointer-events-auto w-[min(78%,440px)]"
            >
              <MightsAccentFrame className="aspect-square p-3">
                <View className={`h-full w-full bg-primary p-[2px] ${cornerCut}`}>
                <View className={`h-full w-full overflow-hidden bg-surface-raised ${cornerCut}`}>
                  <MightsMapImage
                    center={APOLLO.lngLat}
                    zoom={18.4}
                    pitch={58}
                    bearing={-29}
                    width={640}
                    height={640}
                    pins={[{ lngLat: APOLLO.lngLat }]}
                    alt="Close view of the Apollo Theater on West 125th Street"
                    priority
                  />
                </View>
                </View>
              </MightsAccentFrame>
            </View>
          </View>

          <View className="absolute bottom-4 left-4 right-4 flex-row flex-wrap items-end justify-between gap-2">
            <MightsLocationStamp
              name={APOLLO.name}
              street={APOLLO.street}
              href={routes.explore({ place: APOLLO.id })}
            />
            <MapAttribution className="bg-paper/80 px-1.5 py-0.5" />
          </View>
        </View>
      </Section>

      {/* Chapter 2 — start with a block */}
      <Section
        className={`${chapter} grid grid-cols-1 gap-10 py-24 md:grid-cols-12 md:gap-6 md:py-32`}
      >
        <View className="gap-6 md:col-span-4">
          <MightsHeading>Start with a block.</MightsHeading>
          <MightsText>
            Three doors on West 125th Street and Malcolm X Boulevard. Pick one
            and the map keeps everything attached to it: the history, the hours,
            the way in.
          </MightsText>
          <View className="flex-row">
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </View>
        </View>

        <View className="gap-4 md:col-span-8">
          <MightsNotchCard className="aspect-[16/10]">
            <MightsMapImage
              center={HERO_CENTER}
              zoom={15.6}
              width={1200}
              height={750}
              pins={BLOCK.map((p) => ({ lngLat: p.lngLat }))}
              alt="Map of the Apollo Theater, the Studio Museum in Harlem and Sylvia's Restaurant"
            />
          </MightsNotchCard>
          <View className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {BLOCK.map((place) => (
              <MightsButton key={place.id} href={routes.place(place.id)} variant="ghost" size="sm" fill>
                {place.name}
              </MightsButton>
            ))}
          </View>
          <MapAttribution />
        </View>
      </Section>

      {/* Places on the map — composed bento, every tile a real catalogue place */}
      <Section className={`${chapter} gap-10 pb-24 md:pb-32`}>
        <View className="flex-col justify-between gap-4 border-t border-rule-rail pt-6 md:flex-row md:items-end">
          <MightsHeading>Places on the map</MightsHeading>
          <MightsButton href={routes.explore({ view: "list" })} variant="ghost">
            See every place
          </MightsButton>
        </View>
        <MightsPlaceBento places={MAPPED} />
      </Section>

      {/* Chapter 3 — from the map to the sidewalk */}
      <Section className="border-y border-rule-hairline bg-paper">
        <View
          className={`${chapter} grid grid-cols-1 items-center gap-10 py-24 md:grid-cols-12 md:gap-6 md:py-32`}
        >
          <View className="order-2 md:order-1 md:col-span-7">
            <MightsAccentFrame tone="cobalt" className="p-3">
              <View className="aspect-[4/3] overflow-hidden bg-surface-raised">
                <MightsMapImage
                  center={SYLVIAS.lngLat}
                  zoom={18.6}
                  pitch={60}
                  bearing={62}
                  width={960}
                  height={720}
                  pins={[{ lngLat: SYLVIAS.lngLat }]}
                  alt="Street-level map view of Malcolm X Boulevard at Sylvia's Restaurant"
                />
              </View>
            </MightsAccentFrame>
          </View>
          <View className="order-1 gap-6 md:order-2 md:col-span-4 md:col-start-9">
            <MightsHeading>From the map to the sidewalk.</MightsHeading>
            <MightsText>
              In the app, the same place record follows you outside. Hold up
              your phone on the block and the label sits on the building it
              belongs to.
            </MightsText>
            <View className="flex-row">
              <MightsButton href={routes.ar()} variant="secondary">
                See how AR works
              </MightsButton>
            </View>
          </View>
        </View>
      </Section>

      {/* Chapter 7 — close */}
      <Section className={`${chapter} gap-8 py-28 md:py-40`}>
        <MightsHeading size="display-lg" className="max-w-[16ch]">
          Harlem is not a list of landmarks.
        </MightsHeading>
        <View className="flex-row">
          <MightsButton href={routes.explore()}>Open the map</MightsButton>
        </View>
      </Section>
    </Main>
  );
}
