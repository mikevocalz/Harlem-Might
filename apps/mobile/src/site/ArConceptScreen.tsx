import { Text, View } from '@acme/ui/tw';
import { SitePage } from './SitePage';

/**
 * AR concept, ported from apps/web/app/(site)/ar/page.tsx. The copy says what
 * the site says: a design with no code behind it. No "Try AR" control and no
 * camera request until an AR runtime ships in the app. The site's block
 * walkthrough (static maps) and the Sightline render stay on the site.
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
          We also sketched the same idea without a phone in your hand: Sightline, slim glasses with a separate compute
          puck that would show the walking route and place markers ahead of you. It’s a render of hardware that doesn’t
          exist.
        </Text>
      </View>
    </SitePage>
  );
}
