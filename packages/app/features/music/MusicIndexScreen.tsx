import type { MusicArtistRecord } from '@acme/app/content';
import { MightsButton, MightsPage, routes } from '@acme/ui/mights';
import { ContentLoader } from '../site/content/ContentLoader.tsx';
import { ContentNotice } from '../site/content/ContentNotice.tsx';
import type { ScreenResult } from '../site/stories/StoriesScreen.tsx';
import { MusicArtistGrid } from './MusicArtistGrid.tsx';


function MusicIndexBody({ result }: { result: ScreenResult<readonly MusicArtistRecord[]> | undefined }) {
  if (!result) return <ContentLoader label="Checking for published artists" />;
  if (result.status === 'unavailable') {
    return (
      <ContentNotice
        title="We couldn’t check the music directory right now"
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
      lead="The artists who made Harlem a stage and a sound. Every profile names its sources and rights."
    >
      <MusicIndexBody result={result} />
    </MightsPage>
  );
}
