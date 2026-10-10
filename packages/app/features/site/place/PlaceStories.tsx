import type { StoryRecord } from '@acme/app/content';
import type { ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { Image } from '@acme/ui';
import { MightsBand, MightsHeading, MightsMapImage, MightsNotchCard, MightsText, routes } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';

/** Published stories that name this place, newest first, at most three. */
export function storiesAbout(place: Pick<ExplorePlace, 'id'>, stories: readonly StoryRecord[]): StoryRecord[] {
  return stories.filter((s) => s.places.some((p) => p.slug === place.id)).slice(0, 3);
}

/**
 * Story cards with a picture on every card: the story's own lead image, or
 * the place's block from above when the story has none.
 */
export function PlaceStories({ place, stories }: { place: ExplorePlace; stories: readonly StoryRecord[] }) {
  if (stories.length === 0) return null;
  return (
    <MightsBand title={stories.length === 1 ? 'The story here' : 'Stories here'}>
      <View className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {stories.map((story) => {
          const image = story.images[0];
          return (
            <MightsNotchCard key={story.id} href={routes.story(story.slug)}>
              <View className="aspect-video overflow-hidden bg-surface-sunken">
                {image ? (
                  <Image src={image.url} alt={image.altText} className="h-full w-full" sizes="(min-width: 768px) 33vw, 100vw" />
                ) : place.lngLat ? (
                  <MightsMapImage
                    center={place.lngLat}
                    zoom={16}
                    width={640}
                    height={360}
                    pins={[{ lngLat: place.lngLat }]}
                    alt=""
                  />
                ) : null}
              </View>
              <View className="gap-2 p-5">
                <MightsHeading level={3} size="card">
                  {story.title}
                </MightsHeading>
                {story.dek ? <MightsText size="small">{story.dek}</MightsText> : null}
              </View>
            </MightsNotchCard>
          );
        })}
      </View>
    </MightsBand>
  );
}
