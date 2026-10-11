import { getHarlemArchivalImage, type MusicArtistRecord } from '@acme/app/content';
import { Link, Section } from '@acme/ui/html';
import {
  MightsButton,
  MightsEditorialImage,
  MightsHeading,
  MightsPage,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { ContentLoader } from '../site/content/ContentLoader.tsx';
import { ContentNotice } from '../site/content/ContentNotice.tsx';
import { SourcesList } from '../site/content/SourcesList.tsx';
import type { ScreenResult } from '../site/stories/StoriesScreen.tsx';
import { YouTubeEmbed } from './YouTubeEmbed';
import { artistArchiveFallback, biographyParagraphs, musicConnectionLabel, youTubeVideoId } from './music-format.ts';

const archiveImage = getHarlemArchivalImage('nypl-harlem-storefronts-1939');

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex flex-col gap-1">
      <Text className="font-sans text-caption font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</Text>
      <MightsText size="small">{value}</MightsText>
    </View>
  );
}

/** The featured-song panel: an embedded player inside the UI boundary, never a raw third-party iframe. */
function FeaturedSongPanel({ artist }: { artist: MusicArtistRecord }) {
  const song = artist.featuredSong;
  if (!song?.youtubeUrl || !youTubeVideoId(song.youtubeUrl)) return null;
  const title = song.title ?? `A featured recording by ${artist.name}`;
  return (
    <Section aria-labelledby="featured-song" className="flex flex-col gap-3">
      <MightsHeading level={2} size="title" id="featured-song">
        Featured song
      </MightsHeading>
      <YouTubeEmbed url={song.youtubeUrl} title={title} />
      <MightsText size="small">{title}</MightsText>
      <MightsText size="small" className="text-text-muted">
        Plays on YouTube — the embed’s audio can’t be routed into the spatial
        engine, so nothing here is presented as spatial sound.
        {song.verifiedAt ? ` Link verified ${song.verifiedAt.slice(0, 10)}.` : ''}
      </MightsText>
    </Section>
  );
}

/**
 * The XR/spatial affordance. Shown only for records that declare the scene and
 * a separately licensed track; the button stays disabled with an honest reason
 * until the tabletop scene ships — never a fake control.
 */
function SpatialPanel({ artist }: { artist: MusicArtistRecord }) {
  if (!artist.xrSceneEnabled || !artist.spatialTrack) return null;
  const track = artist.spatialTrack;
  return (
    <Section aria-labelledby="spatial-session" className="flex flex-col gap-4 border border-rule-hairline bg-paper/45 p-5">
      <MightsHeading level={2} size="card" id="spatial-session">
        The turntable session
      </MightsHeading>
      <View className="grid gap-3 sm:grid-cols-3">
        {artist.featuredAlbumTitle ? <Fact label="Album" value={artist.featuredAlbumTitle} /> : null}
        <Fact label="Vinyl" value={`${artist.vinylRpm} rpm`} />
        <Fact label="Track format" value={track.format} />
      </View>
      <MightsButton onPress={() => {}} disabled variant="secondary" aria-label={`Play ${artist.name} in XR — not yet available`}>
        Play in XR
      </MightsButton>
      <MightsText size="small" className="text-text-muted">
        The tabletop turntable scene is still in production. When it ships, this
        button plays the separately licensed track through the spatial audio
        engine — licensed audio only, never the YouTube stream.
        {track.licenseSourceUrl ? (
          <>
            {' '}
            <Link href={track.licenseSourceUrl} className="mights-focus text-primary underline underline-offset-4">
              Track licence
            </Link>
            .
          </>
        ) : null}
      </MightsText>
    </Section>
  );
}

function ArtistBody({ artist }: { artist: MusicArtistRecord }) {
  const paragraphs = biographyParagraphs(artist.biography);
  return (
    <Section className="grid gap-10 md:grid-cols-[5fr_7fr]">
      <View className="flex flex-col gap-8">
        <View className="grid gap-4 sm:grid-cols-2">
          <Fact label="Genre" value={artist.genre} />
          {artist.era ? <Fact label="Era" value={artist.era} /> : null}
          <Fact label="Harlem connection" value={musicConnectionLabel(artist.connection)} />
        </View>
        <View className="flex max-w-content-detail flex-col gap-5">
          {paragraphs.map((paragraph, i) => (
            <MightsText key={i}>{paragraph}</MightsText>
          ))}
        </View>
      </View>
      <View className="flex flex-col gap-10">
        <FeaturedSongPanel artist={artist} />
        <SpatialPanel artist={artist} />
        {artist.albumArt ? (
          <Section aria-labelledby="album-art" className="flex flex-col gap-3">
            <MightsHeading level={2} size="title" id="album-art">
              The record
            </MightsHeading>
            <MightsEditorialImage
              image={artist.albumArt}
              screenId={`music-album-${artist.slug}`}
              ratio="standard"
              sizes="(min-width: 768px) 30vw, 100vw"
            />
          </Section>
        ) : null}
      </View>
    </Section>
  );
}

/** One artist profile, shared by the site route and the app route. `result` undefined = still loading. */
export function MusicArtistScreen({
  slug,
  result,
}: {
  slug: string;
  result: ScreenResult<MusicArtistRecord> | { status: 'not-found' } | undefined;
}) {
  if (!result) {
    return (
      <MightsPage title="Harlem Music" crumbs={[{ label: 'Music', href: routes.music() }]}>
        <ContentLoader label="Checking the artist" />
      </MightsPage>
    );
  }
  if (result.status === 'not-found') {
    return (
      <MightsPage title="Harlem Music" crumbs={[{ label: 'Music', href: routes.music() }]}>
        <ContentNotice
          title="This artist isn’t published"
          image={archiveImage}
          actions={<MightsButton href={routes.music()}>All artists</MightsButton>}
        >
          The profile may still be in editorial review, or it was taken down.
          Every published artist is on the Music page.
        </ContentNotice>
      </MightsPage>
    );
  }
  if (result.status === 'unavailable') {
    return (
      <MightsPage title="Harlem Music" crumbs={[{ label: 'Music', href: routes.music() }]}>
        <ContentNotice
          title="We couldn’t load this artist right now"
          image={archiveImage}
          actions={
            <>
              <MightsButton href={routes.musician(slug)}>Try again</MightsButton>
              <MightsButton href={routes.music()} variant="secondary">
                All artists
              </MightsButton>
            </>
          }
        >
          The profile may well be there; we couldn’t reach our records to
          check. Try again in a moment.
        </ContentNotice>
      </MightsPage>
    );
  }
  const artist = result.data;
  const fallback = artistArchiveFallback(artist.slug);
  return (
    <MightsPage
      title={artist.name}
      lead={artist.shortBio}
      crumbs={[
        { label: 'Music', href: routes.music() },
        { label: artist.name, href: routes.musician(artist.slug) },
      ]}
      mediaLayout="leading"
      media={
        artist.headshot ? (
          <MightsEditorialImage
            image={artist.headshot}
            screenId={`music-${artist.slug}`}
            ratio="standard"
            priority
            sizes="(min-width: 768px) 60vw, 100vw"
          />
        ) : fallback ? (
          <MightsEditorialImage
            image={fallback}
            screenId={`music-${artist.slug}`}
            ratio="wide"
            priority
            sizes="(min-width: 768px) 60vw, 100vw"
          />
        ) : undefined
      }
    >
      <ArtistBody artist={artist} />
      <SourcesList sources={artist.sources} />
    </MightsPage>
  );
}
