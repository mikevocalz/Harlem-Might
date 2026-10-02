'use client';

import { Button, Heading, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { getHarlemPlacePreview, useExplore } from './explore.store';

export interface MightsPanelProps {
  onWalkThere?: () => void;
  onEnterAR?: () => void;
}

export function MightsPanel({
  onWalkThere,
  onEnterAR,
}: MightsPanelProps) {
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const savedPreviewIds = useExplore((state) => state.savedPreviewIds);
  const toggleSavedPreview = useExplore((state) => state.toggleSavedPreview);
  const place = getHarlemPlacePreview(selectedPlaceId);

  if (!place) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-surface-raised p-5">
        <Text className="text-sm font-semibold text-text">Mights Panel</Text>
        <Text className="text-center text-xs leading-5 text-text-muted">
          Select a place to see contextual actions and live spatial status.
        </Text>
      </View>
    );
  }

  const saved = savedPreviewIds.includes(place.id);

  return (
    <View className="flex-1 gap-5 bg-surface-raised p-4">
      <View className="gap-1 border-b border-border pb-4">
        <Text className="text-xs font-semibold text-primary">Mights Panel</Text>
        <Heading level={2} size="title" className="text-text">
          {place.name}
        </Heading>
        <Text className="text-xs text-text-muted">
          {place.category} · {place.area}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <View className="min-w-28 flex-1 rounded-xl border border-border bg-surface p-3">
          <Text className="text-[10px] font-semibold text-text-muted">MENU</Text>
          <Text className="mt-1 text-sm font-semibold text-text">
            {place.menuAvailable ? 'Available' : '—'}
          </Text>
        </View>
        <View className="min-w-28 flex-1 rounded-xl border border-border bg-surface p-3">
          <Text className="text-[10px] font-semibold text-text-muted">AR ANCHOR</Text>
          <Text className="mt-1 text-sm font-semibold text-text">
            {place.arCandidate ? 'Candidate' : '—'}
          </Text>
        </View>
        <View className="w-full rounded-xl border border-border bg-surface p-3">
          <Text className="text-[10px] font-semibold text-text-muted">SOURCE STATUS</Text>
          <Text className="mt-1 text-sm font-semibold text-text">Seed preview</Text>
          <Text className="mt-1 text-[11px] leading-4 text-text-muted">
            Live hours, distance and verification freshness appear only after the canonical
            Payload record and source pipeline are connected.
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Button
          title={saved ? 'Saved for this preview' : 'Save place'}
          variant={saved ? 'outline' : 'primary'}
          fullWidth
          onPress={() => toggleSavedPreview(place.id)}
        />
        <Button
          title="Walk there"
          variant="outline"
          fullWidth
          disabled={!onWalkThere}
          onPress={onWalkThere}
        />
        <Button
          title="Enter AR"
          variant="accent"
          fullWidth
          disabled={!onEnterAR}
          onPress={onEnterAR}
        />
      </View>

      <Text className="mt-auto text-[11px] leading-4 text-text-muted">
        Inspector rule: actions and live context only. The full story stays in Place Detail.
      </Text>
    </View>
  );
}
