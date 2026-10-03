import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { MightsBand, MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Harlem Might for iPhone and Android.',
};

export default function DownloadPage() {
  return (
    <MightsPage title="Get the app" lead="Harlem Might for iPhone and Android.">
      <MightsBand title="Not in the stores yet">
        <MightsText>
          The app is in testing and is not listed on the App Store or Google Play yet. The map on this site works now.
        </MightsText>
        <View className="flex-row flex-wrap gap-3">
          <MightsButton href={routes.explore()}>Open the map</MightsButton>
          <MightsButton href={routes.ar()} variant="secondary">
            Preview AR
          </MightsButton>
        </View>
      </MightsBand>
    </MightsPage>
  );
}
