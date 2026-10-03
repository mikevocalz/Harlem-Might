import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { MightsBand, MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';

export const metadata: Metadata = {
  title: 'Press',
  description: 'About Harlem Might for press and media.',
};

export default function PressPage() {
  return (
    <MightsPage title="Press">
      <MightsBand title="About">
        <MightsText>
          Harlem Might is a map of Harlem that keeps the history of each place attached to it. It covers culture, food, parks
          and landmarks, on the web and in an app with AR labels.
        </MightsText>
      </MightsBand>
      <MightsBand title="Press kit">
        <MightsText>The press kit, with the logo and credited photographs, is coming soon.</MightsText>
        <View className="flex-row flex-wrap gap-3">
          <MightsButton href={routes.about()} variant="secondary">
            About Harlem Might
          </MightsButton>
        </View>
      </MightsBand>
    </MightsPage>
  );
}
