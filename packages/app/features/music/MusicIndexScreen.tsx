import {
  getHarlemArchivalImage,
  type MusicArtistRecord,
} from '@acme/app/content';
import { Article, Section } from '@acme/ui/html';
import { Image } from '@acme/ui';
import {
  MightsButton,
  MightsEditorialImage,
  MightsHeading,
  MightsNotchCard,
  MightsPage,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { ContentLoader } from '../site/content/ContentLoader.tsx';
import { ContentNotice } from '../site/content/ContentNotice.tsx';
import type { ScreenResult } from '../site/stories/StoriesScreen.tsx';
import { musicConnectionLabel, youTubeThumbnailUrl } from './music-format.ts';

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

/**
 * The card's media well.
 *
 * Order matters:
 * 1. Rights-cleared CMS headshot.
 * 2. This artist's own featured-performance thumbnail from YouTube.
 * 3. The archival Harlem frame only when neither artist-specific source exists.
 *
 * The performance thumbnail is deliberately labelled as performance artwork,
 * never as a licensed portrait.
 */
function ArtistPortrait({ artist }: { artist: MusicArtistRecord }) {
  const image = artist.headshot;
  if (image) {
    return (
      <View
        className="relative w-full shrink-0 overflow-hidden border-b border-rule-hairline bg-mights-night"
        style={{ aspectRatio: image.aspect ?? 1 }}
      >
        <Image
          src={image.url}
          alt={image.altText}
          fill
          contentFit={image.aspect ? 'cover' : 'contain'}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="h-full w-full"
        />
        <Text
          numberOfLines={1}
          className="absolute bottom-0 right-0 max-w-full bg-mights-night/80 px-2 py-0.5 font-sans text-caption text-text-muted"
        >
          {image.credit} · {image.license}
        </Text>
      </View>
    );
  }

  const performanceImage = artist.featuredSong?.youtubeUrl
    ? youTubeThumbnailUrl(artist.featuredSong.youtubeUrl)
    : undefined;

  if (performanceImage) {
    return (
      <View
        className="relative w-full shrink-0 overflow-hidden border-b border-rule-hairline bg-mights-night"
        style={{ aspectRatio: 16 / 9 }}
      >
        <Image
          src={performanceImage}
          alt={`${artist.name} featured performance artwork`}
          fill
          contentFit="cover"
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="h-full w-full"
        />
        <Text
          numberOfLines={1}
          className="absolute bottom-0 right-0 max-w-full bg-mights-night/80 px-2 py-0.5 font-sans text-caption text-text-muted"
        >
          Featured performance · YouTube
        </Text>
      </View>
    );
  }

  const archive = getHarlemArchivalImage('nypl-lenox-avenue-135th-1939');
  return archive ? (
    <View className="w-full shrink-0 border-b border-rule-hairline">
      <MightsEditorialImage
        image={archive}
        screenId={`music-card-${artist.slug}`}
        ratio="standard"
        interactiveCredit={false}
        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
      />
    </View>
  ) : null;
}

function ArtistCard({ artist }: { artist: MusicArtistRecord }) {
  return (
    <Article className="flex flex-col">
      <MightsNotchCard href={routes.musician(artist.slug)} tone="raised">
        <ArtistPortrait artist={artist} />
        <View className="flex flex-1 flex-col gap-3 p-5">
          <View>
            <MightsHeading level={2} size="card">
              {artist.name}
            </MightsHeading>
            <MightsText size="small" className="mt-1 font-semibold uppercase tracking-[0.12em] text-primary">
              {artist.genre}
              {artist.era ? ` · ${artist.era}` : ''}
            </MightsText>
          </View>
          <MightsText size="small" className="line-clamp-3">
            {artist.shortBio}
          </MightsText>
          <MightsText size="small" className="mt-auto text-text-muted">
            {musicConnectionLabel(artist.connection)}
          </MightsText>
        </View>
      </MightsNotchCard>
    </Article>
  );
}

function ArtistGrid({ artists }: { artists: readonly MusicArtistRecord[] }) {
  return (
    <Section aria-label="Published artists">
      <View className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} />
        ))}
      </View>
    </Section>
  );
}

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
  return <ArtistGrid artists={result.data} />;
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
