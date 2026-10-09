import type { WidgetSnapshot, WidgetCard } from '@acme/widgets';
import HarlemStory from './ios/HarlemStory';
import HarlemEvent from './ios/HarlemEvent';
import HarlemPlace from './ios/HarlemPlace';
import HarlemWalk from './ios/HarlemWalk';

function presentation(card: WidgetCard | null, emptyTitle: string, eyebrow: string, emptyRoute: string) {
  return {
    eyebrow: card?.eyebrow ?? eyebrow,
    title: card?.title ?? emptyTitle,
    subtitle: card?.subtitle ?? 'Open Harlem Might to discover more.',
    destination: card ? `harlemmight://${card.path.slice(1)}` : emptyRoute,
  };
}

/**
 * Native WidgetKit snapshots. Invoke on published content refresh, a saved
 * place change or an active walk update. Never inside a widget component.
 */
export async function publishHomeWidgets(snapshot: WidgetSnapshot): Promise<void> {
  HarlemStory.updateSnapshot(presentation(snapshot.story, 'Explore Harlem', 'THIS IS HARLEM', 'harlemmight://stories'));
  HarlemEvent.updateSnapshot(presentation(snapshot.event, 'Explore today', 'HAPPENING IN HARLEM', 'harlemmight://today'));
  HarlemPlace.updateSnapshot(presentation(snapshot.place, 'Save your Harlem favorites', 'MY HARLEM', 'harlemmight://explore'));
  HarlemWalk.updateSnapshot(presentation(snapshot.walk, 'Start a Harlem walk', 'TAKE ME THERE', 'harlemmight://walks'));
}
