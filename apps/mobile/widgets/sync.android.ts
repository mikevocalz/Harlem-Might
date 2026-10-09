import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@acme/widgets';
import { HarlemWidget } from './android/HarlemWidget';
import { widgetKinds } from './android/task-handler';
import { loadPublicSnapshot, storePublicSnapshot, refreshPublicSnapshot } from './public-feed';

/** Called after a member explicitly changes an active walk or the feed refreshes. */
export async function publishHomeWidgets(snapshot?: WidgetSnapshot): Promise<void> {
  if (snapshot) storePublicSnapshot(snapshot);
  else await refreshPublicSnapshot();
  const current = snapshot ?? loadPublicSnapshot();
  await Promise.allSettled(
    Object.entries(widgetKinds).map(([widgetName, kind]) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: () => React.createElement(HarlemWidget, {
          kind,
          card: current && Date.parse(current.expiresAt) > Date.now() ? current[kind] : null,
        }),
      }),
    ),
  );
}
