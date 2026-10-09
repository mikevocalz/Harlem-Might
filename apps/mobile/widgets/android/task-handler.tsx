'use no memo';
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import type { WidgetKind } from '@acme/widgets';
import { HarlemWidget } from './HarlemWidget';
import { loadPublicSnapshot, refreshPublicSnapshot } from '../public-feed';

const widgetKinds: Record<string, WidgetKind> = {
  HarlemStory: 'story',
  HarlemEvent: 'event',
  HarlemPlace: 'place',
  HarlemWalk: 'walk',
};

/**
 * Headless Android widget task. Treat refresh as best-effort; it must never
 * throw because the server is offline or the phone has no connectivity.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const kind = widgetKinds[props.widgetInfo.widgetName];
  if (!kind) return;
  if (props.widgetAction === 'WIDGET_DELETED') return;
  if (props.widgetAction === 'WIDGET_ADDED' || props.widgetAction === 'WIDGET_UPDATE') {
    await refreshPublicSnapshot().catch(() => null);
  }
  if (props.widgetAction === 'WIDGET_ADDED' || props.widgetAction === 'WIDGET_UPDATE' ||
      props.widgetAction === 'WIDGET_RESIZED' || props.widgetAction === 'WIDGET_CLICK') {
    const snapshot = loadPublicSnapshot();
    // A stale snapshot is NOT a reliable event listing or live walk status.
    const card = snapshot && Date.parse(snapshot.expiresAt) > Date.now() ? snapshot[kind] : null;
    props.renderWidget(<HarlemWidget kind={kind} card={card} />);
  }
}
