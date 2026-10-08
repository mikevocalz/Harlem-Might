import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { MightsBand, MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';

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

export default function DownloadPage() {
  return (
    <MightsPage
      title="The Harlem Might app"
      lead="The app isn't in the App Store or Google Play yet. The map on this site works today."
    >
      <View className="flex flex-row flex-wrap gap-3">
        <MightsButton href={routes.explore()}>Open the map</MightsButton>
        <MightsButton href={routes.ar()} variant="secondary">
          About the AR concept
        </MightsButton>
      </View>
      <MightsBand title="Where the app stands">
        <dl className="flex max-w-content-screen flex-col">
          {platforms.map((p) => (
            <View
              key={p.name}
              className="grid grid-cols-1 gap-2 border-b border-rule-hairline py-6 md:grid-cols-12 md:gap-6"
            >
              {/* <dt> may not hold a heading, so the platform name is bold text. */}
              <dt className="md:col-span-3">
                <MightsText tone="default" className="font-semibold">
                  {p.name}
                </MightsText>
              </dt>
              <dd className="flex flex-col gap-1 md:col-span-9">
                <MightsText tone="default">{p.status}</MightsText>
                <MightsText>{p.detail}</MightsText>
              </dd>
            </View>
          ))}
        </dl>
        <MightsText size="small">
          When a build reaches a store, this page will link to it.
        </MightsText>
      </MightsBand>
    </MightsPage>
  );
}
