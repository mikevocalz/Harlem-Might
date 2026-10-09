import { preload } from 'react-dom';
import { Main, Section, View } from "@acme/ui/tw";
import {
  MapAttribution,
  MightsAccentFrame,
  cornerCut,
  MightsButton,
  MightsHeading,
  MightsEditorialImage,
  MightsLocationStamp,
  MightsMapImage,
  MightsPlaceBento,
  MightsText,
  mapboxStaticSrcSet,
  mapboxStaticUrl,
  routes,
  type BentoModule,
} from "@acme/ui/mights";
import { getHarlemArchivalImage } from '@acme/app/content';
import {
  HARLEM_PLACE_PREVIEWS,
  haversine,
  type HarlemPlacePreview,
} from "@acme/app/features/explore/explore.store.ts";
import { HomeMotion } from "./home/HomeMotion";

// Server component. The only client code on `/` is <HomeMotion />, which
// binds ./motion by marker id and renders nothing.

type MappedPlace = HarlemPlacePreview & { lngLat: readonly [number, number] };
const MAPPED = HARLEM_PLACE_PREVIEWS.filter((p): p is MappedPlace =>
  Boolean(p.lngLat),
);
const byId = (id: string) => MAPPED.find((p) => p.id === id)!;

const APOLLO = byId("apollo-theater");
const STUDIO = byId("studio-museum-harlem");
const SYLVIAS = byId("sylvias-restaurant");

// West 125th Street, between the Apollo and the Studio Museum.
const HERO_CENTER = [
  (APOLLO.lngLat[0] + STUDIO.lngLat[0]) / 2,
  (APOLLO.lngLat[1] + STUDIO.lngLat[1]) / 2,
] as const;

// Centred between the Apollo and Sylvia's so all three doors stay in frame.
const BLOCK_CENTER = [
  (APOLLO.lngLat[0] + SYLVIAS.lngLat[0]) / 2,
  (APOLLO.lngLat[1] + SYLVIAS.lngLat[1]) / 2,
] as const;

/** Straight-line metres between two catalogue points, to the nearest 10. */
const metres = (a: MappedPlace, b: MappedPlace) =>
  Math.round(haversine(a.lngLat, b.lngLat) / 10) * 10;

// One line per place on how it sits on the block, from catalogue coordinates
// and streets (the Studio Museum line is its position between the other two).
// West to east: the walking order and the mobile order.
const BLOCK_MODULES: readonly BentoModule[] = [
  {
    kind: "place",
    place: {
      ...APOLLO,
      shortDescription: `${metres(APOLLO, STUDIO)} m west of the Studio Museum, on the same street.`,
    },
  },
  {
    kind: "place",
    place: {
      ...STUDIO,
      shortDescription: "Between the Apollo and Malcolm X Boulevard.",
    },
  },
  {
    kind: "place",
    place: {
      ...SYLVIAS,
      shortDescription: `${metres(SYLVIAS, STUDIO)} m from the Studio Museum in a straight line.`,
    },
  },
];

// Places off the block lead, so the dominant card isn't a fourth Apollo map.
const BLOCK_IDS = new Set([APOLLO.id, STUDIO.id, SYLVIAS.id]);
const PLACES = [
  ...MAPPED.filter((p) => !BLOCK_IDS.has(p.id)),
  ...MAPPED.filter((p) => BLOCK_IDS.has(p.id)),
].slice(0, 6);

const chapter = "mx-auto w-full max-w-screen-2xl px-4 sm:px-6";
const HOME_ARCHIVE = getHarlemArchivalImage("nypl-harlem-newspaper-stand-1939");

/** The hero frame's exact request — shared by the image and its preload. */
const HERO_MAP = {
  center: HERO_CENTER,
  zoom: 16.2,
  pitch: 50,
  bearing: -29,
  width: 1280,
  height: 960,
} as const;
const HERO_MAP_SIZES = "(min-width: 1024px) 58vw, 100vw";

export function ProductHome() {
  // LCP: the Mapbox statics carry upstream render latency — start the hero
  // fetch at head-parse instead of img-parse. React hoists the link.
  const heroSrc = mapboxStaticUrl(HERO_MAP);
  const heroSrcSet = mapboxStaticSrcSet(HERO_MAP);
  if (heroSrc) {
    preload(heroSrc, {
      as: 'image',
      imageSrcSet: heroSrcSet || undefined,
      imageSizes: HERO_MAP_SIZES,
      fetchPriority: 'high',
    });
  }
  return (
    <Main className="-mt-16 flex-1 bg-surface">
      <HomeMotion />

      {/* 1 — Hero: the block, through the lens */}
      <Section id="trg-hero" className="relative grid grid-cols-1 lg:min-h-svh lg:grid-cols-12">
        <View className="z-10 flex flex-col justify-end gap-8 px-4 pb-12 pt-28 sm:px-6 lg:col-span-5 lg:pb-20 lg:pl-[max(--spacing(6),calc((100vw-var(--container-screen-2xl))/2+--spacing(6)))]">
          <MightsHeading level={1} size="marquee" id="mfx-hero-title">
            See the block. Know the story.
          </MightsHeading>
          {/* Says only what a place record holds today: no history, sources or
              listings exist in the catalogue yet. */}
          <View id="mfx-hero-lead">
            <MightsText size="lead" className="max-w-content-form">
              Harlem&apos;s places on one map, each with why it matters and
              where it sits on the block.
            </MightsText>
          </View>
          <View id="mfx-hero-cta" className="flex-row">
            <MightsButton href={routes.explore()}>Open the map</MightsButton>
          </View>
        </View>

        <View className="relative h-140 overflow-hidden border-t border-rule-hairline lg:col-span-7 lg:h-auto lg:min-h-svh lg:border-l lg:border-t-0">
          <View id="mpx-hero-map" className="absolute inset-x-0 -inset-y-1/12">
            <MightsMapImage
              {...HERO_MAP}
              sizes={HERO_MAP_SIZES}
              alt="Map of West 125th Street in Harlem, from the Apollo Theater to the Studio Museum"
              priority
            />
          </View>

          {/* The lens earns its space by adding what the base map lacks: the
              place as a link and its catalogue description. */}
          <View className="pointer-events-none absolute inset-0 items-center justify-center pb-10">
            <View id="mfx-hero-lens" className="pointer-events-auto w-4/5 max-w-110">
              <MightsAccentFrame className="p-3">
                <View className={`w-full bg-primary p-rail ${cornerCut}`}>
                  <View className={`w-full overflow-hidden bg-surface-raised ${cornerCut}`}>
                    <View className="relative aspect-4/3 w-full">
                      <MightsMapImage
                        center={APOLLO.lngLat}
                        zoom={18.4}
                        pitch={58}
                        bearing={-29}
                        width={640}
                        height={480}
                        sizes="440px"
                        pins={[{ lngLat: APOLLO.lngLat }]}
                        alt="Close view of the Apollo Theater on West 125th Street"
                        priority
                      />
                      <MightsLocationStamp
                        name={APOLLO.name}
                        street={APOLLO.street}
                        href={routes.place(APOLLO.id)}
                        className="absolute bottom-3 left-3"
                      />
                    </View>
                    <View className="border-t border-rule-hairline px-4 pb-6 pt-3">
                      <MightsText size="small" tone="default">
                        {APOLLO.shortDescription}
                      </MightsText>
                    </View>
                  </View>
                </View>
              </MightsAccentFrame>
            </View>
          </View>

          <View className="absolute bottom-4 right-4">
            <MapAttribution className="bg-paper/80 px-1.5 py-0.5" />
          </View>
        </View>
      </Section>

      {/* 2 — Start with a block (B2, map-dominant) */}
      <Section id="trg-block" className={`${chapter} gap-10 py-24 md:py-32`}>
        <View id="mfx-block-copy" className="max-w-content-detail gap-6">
          <MightsHeading>Start with a block.</MightsHeading>
          {/* No hours or entrance promise: the place record has neither field. */}
          <MightsText>
            Three doors on West 125th Street and Malcolm X Boulevard. Pick one
            to see why it matters and how it sits next to the others. Stories,
            walks and sources attach to it as they&apos;re published.
          </MightsText>
        </View>
        <MightsPlaceBento
          variant="map-dominant"
          motionKey="b2"
          lead={{
            kind: "map",
            center: BLOCK_CENTER,
            zoom: 15.8,
            pins: [APOLLO, STUDIO, SYLVIAS].map((p) => ({ lngLat: p.lngLat })),
            alt: "Map of West 125th Street and Malcolm X Boulevard with the Apollo Theater, the Studio Museum in Harlem and Sylvia's Restaurant pinned",
            stamp: {
              name: "West 125th Street",
              street: "and Malcolm X Boulevard",
              href: routes.explore(),
            },
          }}
          modules={BLOCK_MODULES}
        />
      </Section>

      {/* 3 — What a pin can't tell you. Prose only: proof cards wait for the
          first published story, walk or event (MightsNotchCard per record). */}
      <Section id="trg-story" className="border-y border-rule-hairline bg-paper">
        <View
          id="mfx-story-copy"
          className={`${chapter} grid grid-cols-1 gap-8 py-24 md:grid-cols-12 md:gap-6 md:py-32`}
        >
          <View className="gap-6 md:col-span-5">
            <MightsHeading size="display-lg">What a pin can&apos;t tell you</MightsHeading>
            {HOME_ARCHIVE ? (
              <MightsEditorialImage
                image={HOME_ARCHIVE}
                screenId="home"
                ratio="standard"
                sizes="(min-width: 768px) 40vw, 100vw"
              />
            ) : null}
          </View>
          <View className="gap-5 md:col-span-6 md:col-start-7">
            <MightsText size="lead" tone="default">
              A pin gives you an address. A place on Harlem Might is built to
              hold what happened there, who was involved and where each fact
              comes from.
            </MightsText>
            <MightsText>
              Stories will attach to the place they&apos;re about and name
              their sources. Walks will link places in an order that works on
              foot. Events on Today will carry a date and a source. A
              restaurant&apos;s menu belongs on its place, next to its history.
            </MightsText>
            <MightsText>
              The first stories and walks are still being researched. When
              they&apos;re published, they appear on the place page you already
              know.
            </MightsText>
          </View>
        </View>
      </Section>

      {/* 4 — Places on the map (B1, default: module 0 dominant) */}
      <Section id="trg-places" className={`${chapter} gap-10 py-24 md:py-32`}>
        <View id="mfx-places-head" className="flex-col justify-between gap-4 border-t border-rule-rail pt-6 md:flex-row md:items-end">
          <MightsHeading>Places on the map</MightsHeading>
          <MightsButton href={routes.explore({ view: "list" })} variant="ghost">
            See every place
          </MightsButton>
        </View>
        <MightsPlaceBento places={PLACES} motionKey="b1" />
      </Section>

      {/* 5 — From the map to the sidewalk. Phone AR is a concept: no
          place-label AR scene exists, so nothing here claims it works and no
          proof cluster follows. */}
      <Section id="trg-sidewalk" className="border-y border-rule-hairline bg-paper">
        <View
          className={`${chapter} grid grid-cols-1 items-center gap-10 py-24 md:grid-cols-12 md:gap-6 md:py-32`}
        >
          <View id="mfx-sidewalk-frame" className="order-2 gap-3 md:order-1 md:col-span-6 lg:col-span-7">
            <MightsAccentFrame tone="cobalt" className="p-3">
              <View className="aspect-4/3 overflow-hidden bg-surface-raised">
                <MightsMapImage
                  center={SYLVIAS.lngLat}
                  zoom={18.6}
                  pitch={60}
                  bearing={62}
                  width={960}
                  height={720}
                  sizes="(min-width: 768px) 58vw, 100vw"
                  pins={[{ lngLat: SYLVIAS.lngLat }]}
                  alt="Street-level map view of Malcolm X Boulevard at Sylvia's Restaurant"
                />
              </View>
            </MightsAccentFrame>
            <View className="flex-row flex-wrap items-baseline justify-between gap-2">
              <MightsText size="small">
                Map view at Sylvia&apos;s. The AR view is a concept, so there is
                no AR capture to show yet.
              </MightsText>
              <MapAttribution />
            </View>
          </View>
          <View id="mfx-sidewalk-copy" className="order-1 gap-6 md:order-2 md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
            <MightsHeading>From the map to the sidewalk.</MightsHeading>
            <MightsText>
              On the sidewalk the question is which building. We&apos;re
              exploring an AR view for the app that puts the place name on the
              facade in front of you, from the same place record you opened on
              the map.
            </MightsText>
            <MightsText>
              It&apos;s a concept for now. The map on this site works today.
            </MightsText>
            <View className="flex-row">
              <MightsButton href={routes.ar()} variant="secondary">
                About the AR concept
              </MightsButton>
            </View>
          </View>
        </View>
      </Section>

      {/* 6 — Close */}
      <Section id="trg-close" className={`${chapter} gap-8 py-28 md:py-40`}>
        <MightsHeading size="display-lg" className="max-w-[16ch]" id="mfx-close-title">
          Harlem is not a list of landmarks.
        </MightsHeading>
        <View id="mfx-close-lead">
          <MightsText size="lead">
            Start on one block and follow what&apos;s attached to it.
          </MightsText>
        </View>
        <View id="mfx-close-cta" className="flex-row">
          <MightsButton href={routes.explore()}>Open the map</MightsButton>
        </View>
      </Section>
    </Main>
  );
}
