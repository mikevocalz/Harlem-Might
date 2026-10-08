'use client';

import { IconButton, SearchBar, Text } from '@acme/ui';
import { X } from '@acme/ui/icons';
import { Pressable, View } from '@acme/ui/tw';
import { getHarlemPlacePreview, useExplore } from './explore.store';
import { useExploreType } from './explore-type';
import {
  ASSISTANT_STATUS,
  assistantBarLabel,
  assistantSuggestions,
  nearbyAnswer,
  useMightsAssistant,
  type AssistantSuggestion,
} from './mights-assistant.store';

export interface MightsAssistantProps {
  /** Opens a place (selection plus whatever surface shows Detail). */
  onOpenPlace: (placeId: string) => void;
  /** Shows the selected place's details. */
  onShowDetails: () => void;
  /** Brings the map forward with the selected place on it. */
  onShowOnMap: () => void;
  /** `sheet` spans the map width (compact); `panel` is 400dp bottom-trailing. */
  layout: 'panel' | 'sheet';
}

/**
 * The assistant's visual mark. No Rive asset exists yet, so this is a static
 * token-drawn ring; `mights-assistant.riv` replaces it under the contract in
 * docs/spatial-layout/HANDOFF.md (state machine `Assistant`, inputs
 * `activity` 0–4 and `reduceMotion`).
 */
function AssistantMark() {
  return (
    <View aria-hidden className="size-marker-selected items-center justify-center rounded-full border-2 border-primary bg-surface">
      <View className="size-2 rounded-full bg-primary" />
    </View>
  );
}

/**
 * "Ask Harlem Might", inline in the map region (handoff §6, DECISIONS S7).
 *
 * Collapsed, it's a 48dp bar. Expanded, it offers only what the app can do
 * today: search the places, open the selected place's details, say what's
 * nearby from real coordinates, and show the place on the map. There's no
 * speech or generated answer behind it, so it never pretends to listen or
 * talk; `activity` stays `idle` until a provider is wired.
 */
export function MightsAssistant({ onOpenPlace, onShowDetails, onShowOnMap, layout }: MightsAssistantProps) {
  const type = useExploreType();
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const place = getHarlemPlacePreview(selectedPlaceId);
  const open = useMightsAssistant((state) => state.open);
  const activity = useMightsAssistant((state) => state.activity);
  const answer = useMightsAssistant((state) => state.answer);
  const draft = useMightsAssistant((state) => state.draft);
  const setOpen = useMightsAssistant((state) => state.setOpen);
  const setDraft = useMightsAssistant((state) => state.setDraft);
  const answerNearby = useMightsAssistant((state) => state.answerNearby);
  const close = useMightsAssistant((state) => state.close);
  const status = ASSISTANT_STATUS[activity];

  const frame =
    layout === 'sheet'
      ? 'absolute bottom-4 left-4 right-4'
      : 'absolute bottom-4 right-4 w-assistant-panel max-w-full';

  if (!open) {
    return (
      <View className="absolute bottom-12 left-0 right-0 items-center px-4" pointerEvents="box-none">
        <Pressable
          onPress={() => setOpen(true)}
          aria-label={place ? `Ask about ${place.name}` : 'Ask Harlem Might about places on the map'}
          className="min-h-target w-full max-w-assistant-bar flex-row items-center gap-target-gap rounded-full border border-border-strong bg-surface-raised px-4"
        >
          <AssistantMark />
          <Text numberOfLines={1} className={type.label + ' flex-1 font-sans-semibold text-text'}>
            {assistantBarLabel(place)}
          </Text>
        </Pressable>
      </View>
    );
  }

  const run = (suggestion: AssistantSuggestion) => {
    switch (suggestion.kind) {
      case 'show-details':
        onShowDetails();
        return;
      case 'nearby':
        answerNearby(suggestion.placeId);
        return;
      case 'show-on-map':
        close();
        onShowOnMap();
        return;
      case 'open-place':
        close();
        onOpenPlace(suggestion.placeId);
        return;
    }
  };

  const suggestions = assistantSuggestions(place, draft);

  return (
    <View
      className={frame + ' max-h-1/2 gap-target-gap rounded-sheet border border-border-strong bg-surface-raised p-4'}
      aria-label="Ask Harlem Might"
    >
      <View className="h-rail -mx-4 -mt-4 mb-1 rounded-t-sheet bg-rule-rail" />
      <View className="flex-row items-center gap-target-gap">
        <AssistantMark />
        <Text role="heading" className={type.title + ' flex-1 font-sans-semibold text-text'}>
          Ask Harlem Might
        </Text>
        <IconButton
          size="lg"
          variant="ghost"
          aria-label="Close Ask Harlem Might"
          icon={<X size={22} strokeWidth={2.5} className="text-text" />}
          onPress={close}
        />
      </View>

      {status ? (
        <Text aria-live="polite" className={type.caption + ' text-text-muted'}>
          {status}
        </Text>
      ) : null}

      {place ? (
        <Text className={type.body + ' text-text'}>
          {place.name}: {place.shortDescription}
        </Text>
      ) : (
        <>
          <Text className={type.body + ' text-text'}>
            {
              "I can find places on this map and show what our records say about them. I don't have hours or events yet."
            }
          </Text>
          <SearchBar
            value={draft}
            onChangeText={setDraft}
            placeholder="Search places, streets, history"
            aria-label="Search Harlem places"
            className="min-h-target"
          />
        </>
      )}

      {answer.kind === 'nearby' && place && answer.placeId === place.id ? (
        <Text aria-live="polite" className={type.body + ' text-text'}>
          {nearbyAnswer(place)}
        </Text>
      ) : null}

      {suggestions.length > 0 ? (
        <View className="gap-1">
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.kind + suggestion.placeId}
              onPress={() => run(suggestion)}
              className="min-h-target justify-center rounded-card border border-border-strong bg-surface px-4"
            >
              <Text className={type.label + ' font-sans-semibold text-text'}>{suggestion.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : draft.trim() ? (
        <Text aria-live="polite" className={type.body + ' text-text-muted'}>
          {`No places match "${draft.trim()}".`}
        </Text>
      ) : null}
    </View>
  );
}
