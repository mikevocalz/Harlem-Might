import type { Metadata } from 'next';
import { MightsBand, MightsPage, MightsText } from '@acme/ui/mights';
import { ArStatusList } from '../../../components/ar/ArStatusList';
import { ArWalkthrough } from '../../../components/ar/ArWalkthrough';
import { SightlineIsland } from '../../../components/ar/SightlineIsland';

// Order: usefulness and status first, the block walkthrough (LCP lives here or
// in the h1), then Sightline far below the fold, then status per target.
// No camera request and no WebXR on this page (audit §21).
export const metadata: Metadata = {
  title: 'AR concept',
  description:
    'A concept for an AR view in the Harlem Might app that names the building in front of you. Design only, with no code yet.',
};

export default function ArPage() {
  return (
    <MightsPage
      title="Know which building you’re looking at"
      lead="That’s the job of an AR view we’re designing for the Harlem Might app: hold up your phone on the block and the place name sits on the building in front of you, one tap from its story. It’s a concept. There’s no code for it yet, and this page never asks for your camera."
    >
      <ArWalkthrough />
      <MightsBand title="Sightline, a concept render">
        <MightsText>
          We also sketched the same idea without a phone in your hand: Sightline, slim glasses with a separate compute
          puck that would show the walking route and place markers ahead of you. It’s a render of hardware that doesn’t
          exist.
        </MightsText>
        <SightlineIsland />
      </MightsBand>
      <ArStatusList />
    </MightsPage>
  );
}
