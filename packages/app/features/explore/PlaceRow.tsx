'use client';

import { Text, View } from '@acme/ui/tw';
import { FocusPressable } from './FocusPressable';
import { placeRowLine } from './explore-copy';
import type { HarlemPlacePreview } from './explore.store';
import { useExploreType } from './explore-type';
import { focusTargetRef, rowFocusId } from './focus-registry';

export interface PlaceRowProps {
  place: HarlemPlacePreview;
  selected: boolean;
  onPress: () => void;
  /** Horizontal padding: `window` (24dp) inside a Horizon window, `pane` (20dp) elsewhere. */
  padding?: 'window' | 'pane';
}

/**
 * One result row, drawn like the site's Explore list
 * (apps/web/components/explore/ExploreWorkspace.tsx): a flat row on a
 * hairline divider, a gold diamond, the name, and "Category, street" under it.
 * Selection adds a 2dp gold leading rail, a raised fill, a larger gold diamond
 * and the `selected` state, so it never rests on colour alone.
 */
export function PlaceRow({ place, selected, onPress, padding = 'pane' }: PlaceRowProps) {
  const type = useExploreType();
  const line = placeRowLine(place);

  return (
    <FocusPressable
      ref={focusTargetRef(rowFocusId(place.id))}
      onPress={onPress}
      accessibilityState={{ selected }}
      aria-selected={selected}
      aria-label={`${place.name}, ${line}.${selected ? ' Selected.' : ''}`}
      className={
        'min-h-target flex-row border-b border-rule-hairline ' +
        (selected ? 'bg-surface-raised' : 'bg-surface active:bg-surface-raised')
      }
    >
      <View className={'w-rail ' + (selected ? 'bg-primary' : 'bg-transparent')} />
      <View className={'flex-1 flex-row items-start gap-4 py-4 ' + (padding === 'window' ? 'px-window' : 'px-5')}>
        <View className="size-5 items-center justify-center">
          <View className={'size-2.5 rotate-45 ' + (selected ? 'bg-primary' : 'bg-rule-rail')} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className={type.body + ' font-sans-semibold text-text'}>{place.name}</Text>
          <Text className={type.caption + ' font-sans text-text-muted'}>{line}</Text>
        </View>
      </View>
    </FocusPressable>
  );
}
