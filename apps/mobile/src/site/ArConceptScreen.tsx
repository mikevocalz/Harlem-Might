import { Image } from 'expo-image';
import { Text, View } from '@acme/ui/tw';
import { SitePage } from './SitePage';

const LABEL =
  'Concept render of Sightline: AR glasses over a street view, showing a walking route to the Apollo Theater, four minutes, and Sylvia’s Restaurant, seven minutes.';

// Bundled asset — the concept render must paint offline, so it ships with the
// app rather than coming over the wire.
const SIGHTLINE_RENDER = require('../../assets/images/sightline-concept.jpg');

/**
 * AR concept, ported from apps/web/app/(site)/ar/page.tsx. The copy says what
 * the site says: a design with no code behind it. No "Try AR" control and no
 * camera request until an AR runtime ships in the app. The site's block
 * walkthrough (static maps) stays on the site.
 */
export function ArConceptScreen() {
  return (
    <SitePage
      underHeader
      title="Know which building you’re looking at"
      lead="That’s the job of an AR view we’re designing for the Harlem Might app: hold up your phone on the block and the place name sits on the building in front of you, one tap from its story. It’s a concept. There’s no code for it yet, and this page never asks for your camera."
    >
      <View className="max-w-content-detail gap-4 border-t border-rule-hairline pt-6">
        <Text role="heading" aria-level={2} className="font-sans text-title font-semibold text-text">
          Sightline, a concept render
        </Text>
        <Text className="font-sans text-body text-text-muted">
          We also sketched the same idea without a phone in your hand: Sightline, lightweight glasses paired with a
          small compute puck, drawing a walking route across the street and floating place labels ahead of you —
          Apollo Theater in four minutes, Sylvia’s Restaurant in seven. It’s a render of hardware that doesn’t exist.
        </Text>
        <Image
          source={SIGHTLINE_RENDER}
          accessibilityLabel={LABEL}
          contentFit="cover"
          style={{ aspectRatio: 3 / 2, width: '100%' }}
        />
        <Text className="font-sans text-label text-text-muted">
          Concept render. The glasses and puck don’t exist; nobody can buy them and we haven’t built for them.
        </Text>
      </View>
    </SitePage>
  );
}
