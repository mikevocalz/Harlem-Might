import {
  getHarlemArchivalImage,
  type MusicArtistRecord,
} from '@acme/app/content';
import {
  MightsButton,
  MightsEditorialImage,
  MightsPage,
  routes,
} from '@acme/ui/mights';
import { ContentLoader } from '../site/content/ContentLoader.tsx';
import { ContentNotice } from '../site/content/ContentNotice.tsx';
import type { ScreenResult } from '../site/stories/StoriesScreen.tsx';
import { MusicArtistGrid } from './MusicArtistGrid.tsx';

const heroImage = getHarlemArchivalImage('nypl-seventh-avenue-west-125th-1934');
const archiveImage = getHarlemArchivalImage('nypl-harlem-storefronts-1939');

const hero = heroImage ? (
  <MightsEditorialImage
    image={heroImage}
    screenId="music-hero"
    ratio="wide"
    priority
    sizes="(min-width: 768px) 60vw, 100vw"
  />
) : undefined;

function MusicIndexBody({ result }: { result: ScreenResult<readonly MusicArtistRecord[]> | undefined }) {
  if (!result) return <ContentLoader label="Checking for published artists" />;
  if (result.status === 'unavailable') {
    return (
      <ContentNotice
        title="We couldn’t check the music directory right now"
        image={archiveImage}
        actions={
          <>
            <MightsButton href={routes.music()}>Try again</MightsButton>
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </>
        }
      >
        Our records didn’t answer, so we can’t say which artist profiles are
        published. Try again in a moment.
      </ContentNotice>
    );
  }
  if (result.data.length === 0) {
    return (
      <ContentNotice
        title="No artist profiles are published yet"
        image={archiveImage}
        actions={
          <MightsButton href={routes.explore()} variant="secondary">
            Open the map
          </MightsButton>
        }
      >
        Artist biographies join the directory as editorial verification and
        image licensing are completed. The map and walks are ready now.
      </ContentNotice>
    );
  }
  return <MusicArtistGrid artists={result.data} />;
}

/** The Music index, shared by the site page and the app tab. `result` undefined = still loading. */
export function MusicIndexScreen({ result }: { result: ScreenResult<readonly MusicArtistRecord[]> | undefined }) {
  return (
    <MightsPage
      title="Harlem Music"
      mediaLayout="leading"
      lead="The artists who made Harlem a stage and a sound. Every profile names its sources and rights."
      media={hero}
    >
      <MusicIndexBody result={result} />
    </MightsPage>
  );
}
