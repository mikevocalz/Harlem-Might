import { HARLEM_ARCHIVAL_IMAGES, getHarlemArchivalImage, type EditorialImage, type StoryRecord } from '@acme/app/content';
import { Article, List, ListItem, Section } from '@acme/ui/html';
import {
  MightsEditorialImage,
  MightsHeading,
  MightsMapImage,
  MightsNotchCard,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { Image } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { assignStoryPhotos, storyDates, storyPhotos } from './story-format.ts';

// B8. References (structure only): KOBU three-up editorial row
// (mobbin.com/sites/sections/f5959421-5ded-4adb-98db-49143db77839) and
// Assembly Coffee journal lead (mobbin.com/sites/sections/2218a2ac-844a-42bc-b957-64ac22214a79):
// one feature with its picture, a few secondary headlines, author and date on each.


const archiveFrames = [
  {
    id: 'nypl-lenox-market-picket-1939',
    context: 'Labor, commerce and the street-level record behind a Harlem business story.',
  },
  {
    id: 'nypl-ninth-avenue-vendors-1939',
    context: 'Vendors under the el — everyday trade and talk moving through Harlem.',
  },
] as const;

const editorialRules = [
  'Every story is attached to the place where it happened.',
  'Dates, sources and image credits stay visible on the page.',
  'Archival photographs are context — never a stand-in for a current venue.',
];

/** An archive photograph picked from the slug, so neighbouring stories don't share one. */
export function storyArchiveImage(slug: string) {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return HARLEM_ARCHIVAL_IMAGES[hash % HARLEM_ARCHIVAL_IMAGES.length];
}

/**
 * The card's image well. In order: the story's own image, a photo of the
 * place it is attached to, a satellite render of that place, an archive
 * photograph. Every card opens on a picture.
 */
export function StoryMedia({ story, photo }: { story: StoryRecord; photo?: EditorialImage | null }) {
  const place = story.places.find((p) => p.images?.length || p.lngLat);
  // `photo` from assignStoryPhotos on a page of cards; a lone card (the story hero) takes its first.
  const image = photo === undefined ? storyPhotos(story)[0] : photo ?? undefined;
  if (image) {
    // The photo's own aspect ratio sizes the well, so the masonry never crops
    // a face or a facade. Full credit and licence are on the story page.
    return (
      <View
        className="relative w-full shrink-0 overflow-hidden border-b border-rule-hairline bg-mights-night"
        style={{ aspectRatio: image.aspect ?? 4 / 3 }}
      >
        <Image
          src={image.url}
          alt={image.altText}
          fill
          contentFit={image.aspect ? 'cover' : 'contain'}
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
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
  if (place?.lngLat) {
    return (
      <View className="aspect-4/3 w-full shrink-0 border-b border-rule-hairline">
        <MightsMapImage
          center={place.lngLat}
          zoom={17}
          pitch={45}
          width={720}
          height={540}
          pins={[{ lngLat: place.lngLat }]}
          alt={`Satellite view of ${place.name}`}
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
        />
      </View>
    );
  }
  const archive = storyArchiveImage(story.slug);
  return archive ? (
    <View className="w-full shrink-0 border-b border-rule-hairline">
      <MightsEditorialImage
        image={archive}
        screenId={`story-card-${story.slug}`}
        ratio="standard"
        interactiveCredit={false}
        sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
      />
    </View>
  ) : null;
}

function StoryModule({
  story,
  featured,
  headingLevel,
  inverted = false,
  photo,
}: {
  story: StoryRecord;
  featured: boolean;
  headingLevel: 2 | 3;
  /** On an inverted (gold) card: dark text. */
  inverted?: boolean;
  /** The photo assigned by assignStoryPhotos; null = none left, use the map or archive. */
  photo?: EditorialImage | null;
}) {
  const { published, updated } = storyDates(story);
  const date = published ?? updated;
  return (
    <>
      <StoryMedia story={story} photo={photo} />
      <View className="flex flex-1 flex-col gap-3 p-5">
        <MightsHeading level={headingLevel} size={featured ? 'title' : 'card'} className={inverted ? 'text-on-primary' : ''}>
          {story.title}
        </MightsHeading>
        {story.dek ? (
          <MightsText
            size={featured ? 'body' : 'small'}
            tone="default"
            className={`${featured ? '' : 'line-clamp-3'} ${inverted ? 'text-on-primary' : ''}`}
          >
            {story.dek}
          </MightsText>
        ) : null}
        <MightsText size="small" className={`mt-auto ${inverted ? 'text-on-primary/75' : ''}`}>
          By {story.author}
          {date ? `, ${date}` : ''}
        </MightsText>
      </View>
    </>
  );
}

const invertAt = (i: number) => i % 5 === 2;

function StoryList({ stories, headingLevel }: { stories: readonly StoryRecord[]; headingLevel: 2 | 3 }) {
  // Masonry: CSS columns let portrait and landscape photos keep their own
  // shape, so no image is cropped or letterboxed. Native has no columns and
  // stacks the same cards in one list.
  const photos = assignStoryPhotos(stories);
  return (
    <List className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 md:block md:columns-2 md:gap-4 lg:columns-3">
      {stories.map((story, i) => (
        <ListItem key={story.id} className="flex flex-col md:mb-4 md:break-inside-avoid">
          {/* Every fourth card, offset, is inverted so the grid doesn't read as one repeated tile. */}
          <MightsNotchCard href={routes.story(story.slug)} tone={invertAt(i) ? 'inverted' : 'raised'}>
            <StoryModule story={story} featured={false} headingLevel={headingLevel} inverted={invertAt(i)} photo={photos.get(story.id) ?? null} />
          </MightsNotchCard>
        </ListItem>
      ))}
    </List>
  );
}

/**
 * The editorial desk under the story feed. It gives the index real material
 * even before the first commissioned story lands, without presenting archive
 * photographs as stories.
 */
export function StoriesArchiveStrip() {
  const frames = archiveFrames.flatMap((frame) => {
    const image = getHarlemArchivalImage(frame.id);
    return image ? [{ ...frame, image }] : [];
  });

  return (
    <Section aria-labelledby="story-archive" className="grid gap-8 border-t border-rule-rail pt-10 md:grid-cols-12">
      <View className="flex flex-col gap-5 md:col-span-4">
        <MightsText size="small" className="font-semibold uppercase tracking-[0.16em] text-primary">
          Archive frame
        </MightsText>
        <MightsHeading level={2} size="title" id="story-archive">
          The record behind the stories
        </MightsHeading>
        <MightsText>
          While commissioned stories are reported, these licensed NYPL frames show the kinds of Harlem records a story
          has to carry: place, date, source and credit.
        </MightsText>
        <List className="list-disc space-y-2 pl-5">
          {editorialRules.map((rule) => (
            <ListItem key={rule}>
              <MightsText size="small">{rule}</MightsText>
            </ListItem>
          ))}
        </List>
      </View>
      <View className="grid gap-6 sm:grid-cols-2 md:col-span-8 lg:grid-cols-3">
        {frames.map((frame) => (
          <Article key={frame.id} className="flex flex-col gap-3 border-t border-rule-hairline pt-3">
            <MightsEditorialImage
              image={frame.image}
              screenId={`stories-archive-${frame.id}`}
              ratio="standard"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 100vw"
            />
            <MightsText size="small">{frame.context}</MightsText>
          </Article>
        ))}
      </View>
    </Section>
  );
}

export function StoriesIndex({ stories }: { stories: readonly StoryRecord[] }) {
  return <StoryList stories={stories} headingLevel={2} />;
}
