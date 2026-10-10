import type { Metadata } from 'next';
import { getHarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { DescriptionDetails, DescriptionList, DescriptionTerm, Figcaption, Figure } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import {
  MapAttribution,
  MightsBand,
  MightsButton,
  MightsMapImage,
  MightsNotchCard,
  MightsPage,
  MightsText,
  routes,
} from '@acme/ui/mights';

// The phone app has no public build: apps/mobile/eas.json ships internal
// distribution only and an empty submit profile, so there is nothing to
// download. The primary action is the web map because it is the one thing a
// visitor can use today. No store badges, QR code or waitlist form: each
// would point at a destination or backend that does not exist.

export const metadata: Metadata = {
  title: 'The app',
  description: 'Where the Harlem Might app for iPhone and Android stands. The map works on the web today.',
};

// Status words come from docs/META_VR_GLASSES.md, one meaning each.
// XR-PLATFORM-MATRIX.md lists phones as "integrated", which maps to
// "integration path". Nothing records a run on a phone, so "in testing"
// would overclaim.
const platforms = [
  {
    name: 'iPhone',
    status: 'Integration path',
    detail: 'The code is merged and builds. It has not been released, and there is no App Store or TestFlight listing.',
  },
  {
    name: 'Android',
    status: 'Integration path',
    detail: 'The code is merged and builds. It has not been released, and there is no Google Play listing or public test.',
  },
] as const;

// The same real catalogue points the product map opens on.
const MAP_POINTS = ['apollo-theater', 'studio-museum-harlem', 'sylvias-restaurant'].flatMap((id) => {
  const place = getHarlemPlacePreview(id);
  return place?.lngLat ? [{ lngLat: place.lngLat }] : [];
});
const MAP_CENTER = MAP_POINTS.length
  ? ([
      MAP_POINTS.reduce((sum, point) => sum + point.lngLat[0], 0) / MAP_POINTS.length,
      MAP_POINTS.reduce((sum, point) => sum + point.lngLat[1], 0) / MAP_POINTS.length,
    ] as const)
  : undefined;

export default function DownloadPage() {
  return (
    <MightsPage
      title="The Harlem Might app"
      lead="The app isn't in the App Store or Google Play yet. The map on this site works today."
      media={MAP_CENTER ? (
        <Figure className="flex flex-col gap-2">
          <MightsNotchCard className="aspect-4/3">
            <MightsMapImage
              center={MAP_CENTER}
              zoom={15.8}
              pitch={45}
              bearing={-29}
              width={960}
              height={720}
              sizes="(min-width: 768px) 40vw, 100vw"
              pins={MAP_POINTS}
              alt="Aerial map of West 125th Street in Harlem with the Apollo Theater, the Studio Museum in Harlem and Sylvia's Restaurant marked"
              priority
            />
          </MightsNotchCard>
          <Figcaption className="text-label text-text-muted">
            Aerial map around three catalogue places on and near West 125th Street.
          </Figcaption>
          <MapAttribution />
        </Figure>
      ) : undefined}
    >
      <View className="flex flex-row flex-wrap gap-3">
        <MightsButton href={routes.explore()}>Open the map</MightsButton>
        <MightsButton href={routes.ar()} variant="secondary">
          About the AR concept
        </MightsButton>
      </View>
      <MightsBand title="Where the app stands">
        <DescriptionList className="flex max-w-content-screen flex-col">
          {platforms.map((p) => (
            <View
              key={p.name}
              className="grid grid-cols-1 gap-2 border-b border-rule-hairline py-6 md:grid-cols-12 md:gap-6"
            >
              {/* <DescriptionTerm> may not hold a heading, so the platform name is bold text. */}
              <DescriptionTerm className="md:col-span-3">
                <MightsText tone="default" className="font-semibold">
                  {p.name}
                </MightsText>
              </DescriptionTerm>
              <DescriptionDetails className="flex flex-col gap-1 md:col-span-9">
                <MightsText tone="default">{p.status}</MightsText>
                <MightsText>{p.detail}</MightsText>
              </DescriptionDetails>
            </View>
          ))}
        </DescriptionList>
        <MightsText size="small">
          When a build reaches a store, this page will link to it.
        </MightsText>
      </MightsBand>
    </MightsPage>
  );
}
