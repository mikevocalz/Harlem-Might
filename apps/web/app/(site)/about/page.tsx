import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { MightsBand, MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';

export const metadata: Metadata = {
  title: 'About',
  description: 'Who makes Harlem Might, how places are researched, and where the facts come from.',
};

export default function AboutPage() {
  return (
    <MightsPage title="About Harlem Might" lead="A guide to Harlem built from local knowledge, one place at a time.">
      <MightsBand title="Mission">
        <MightsText>
          Keep the story of a place attached to the place. Restaurants, theaters, parks and homes sit on one map with
          the history that makes them matter.
        </MightsText>
      </MightsBand>
      <MightsBand title="Method">
        <MightsText>
          Every place starts as a single record with one location. Facts are added only with a source, and a record is
          corrected when a source shows it is wrong.
        </MightsText>
      </MightsBand>
      <MightsBand title="Sources">
        <MightsText>
          Archival research draws on public collections such as the Schomburg Center for Research in Black Culture, NYPL
          Digital Collections and the Library of Congress. Locations come from OpenStreetMap, and maps are drawn by
          Mapbox.
        </MightsText>
      </MightsBand>
      <MightsBand title="Report a correction">
        {/* ponytail: no contact address exists in the repo yet; add a mailto or form here once one is chosen. */}
        <MightsText>A corrections address is being set up. Until then, every place page lists where its facts come from.</MightsText>
        <View className="flex-row flex-wrap gap-3">
          <MightsButton href={routes.press()} variant="secondary">
            Press
          </MightsButton>
          <MightsButton href={routes.explore()}>Open the map</MightsButton>
        </View>
      </MightsBand>
    </MightsPage>
  );
}
