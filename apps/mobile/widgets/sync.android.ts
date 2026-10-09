import { requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@acme/widgets';
import { storePublicSnapshot, refreshPublicSnapshot } from './public-feed';

/** Called after a member explicitly changes an active walk or the feed refreshes. */
export async function publishHomeWidgets(snapshot?: WidgetSnapshot): Promise<void> {
  if (snapshot) storePublicSnapshot(snapshot);
  else await refreshPublicSnapshot();
  await Promise.allSettled(
    ['HarlemStory', 'HarlemEvent', 'HarlemPlace', 'HarlemWalk'].map(
      widgetName => requestWidgetUpdate({ widgetName }),
    ),
  );
}
