import { create } from 'zustand';
import {
  filterHarlemPlacePreviews,
  formatDistance,
  nearbyPlaces,
  type HarlemPlacePreview,
} from './explore.store.ts';

/**
 * What the assistant is doing. `listening`, `thinking` and `speaking` need a
 * speech and answer provider, and `navigation` needs a route provider; none is
 * wired today, so only `idle` is reachable from the UI. The states exist so
 * the Rive contract (docs/spatial-layout/HANDOFF.md) and the status copy have
 * one source.
 */
export type AssistantActivity = 'idle' | 'listening' | 'thinking' | 'speaking' | 'navigation';

/** The `activity` number input of the `Assistant` Rive state machine. */
export const ASSISTANT_RIVE_ACTIVITY: Record<AssistantActivity, number> = {
  idle: 0,
  listening: 1,
  thinking: 2,
  speaking: 3,
  navigation: 4,
};

/** Status line for each activity (copy.md §4.3). `idle` shows none. */
export const ASSISTANT_STATUS: Record<AssistantActivity, string | null> = {
  idle: null,
  listening: 'Listening…',
  thinking: 'Looking that up…',
  speaking: 'Speaking…',
  navigation: null,
};

/**
 * Which inline answer the expanded panel shows. Every answer is assembled
 * from fields the app already holds; the assistant never writes hours,
 * events, crowds or prices.
 */
export type AssistantAnswer = { kind: 'none' } | { kind: 'nearby'; placeId: string };

export interface MightsAssistantState {
  /** Whether the panel is expanded. Collapsed shows the 48dp bar only. */
  open: boolean;
  activity: AssistantActivity;
  /** Active walk. `null` until a route provider exists (copy.md §4.4). */
  walk: null | { placeId: string };
  answer: AssistantAnswer;
  /** Text typed into the panel's search field. */
  draft: string;
  setOpen: (open: boolean) => void;
  setActivity: (activity: AssistantActivity) => void;
  setDraft: (draft: string) => void;
  /** Shows the "What's nearby" answer for `placeId`. */
  answerNearby: (placeId: string) => void;
  /** Collapses the panel and clears the answer and draft. */
  close: () => void;
}

export const useMightsAssistant = create<MightsAssistantState>((set) => ({
  open: false,
  activity: 'idle',
  walk: null,
  answer: { kind: 'none' },
  draft: '',
  setOpen: (open) => set({ open }),
  setActivity: (activity) => set({ activity }),
  setDraft: (draft) => set({ draft }),
  answerNearby: (placeId) => set({ answer: { kind: 'nearby', placeId } }),
  close: () => set({ open: false, answer: { kind: 'none' }, draft: '' }),
}));

/** The collapsed bar's label (copy.md §4.1). */
export function assistantBarLabel(place: HarlemPlacePreview | null): string {
  return place ? `Ask about ${place.name}` : 'Ask Harlem Might';
}

/** An action the panel offers. Each one maps to something the app does today. */
export type AssistantSuggestion =
  | { kind: 'show-details'; label: string; placeId: string }
  | { kind: 'nearby'; label: string; placeId: string }
  | { kind: 'show-on-map'; label: string; placeId: string }
  | { kind: 'open-place'; label: string; placeId: string };

/**
 * The suggestion rows for the expanded panel.
 *
 * With a place selected: "Why it matters" (opens its details), "What's
 * nearby" (only when the place has coordinates), "Show on map".
 * Without one: up to three places matching `draft`, each opening that place.
 * An empty draft lists nothing, so the panel never suggests a canned query.
 */
export function assistantSuggestions(
  place: HarlemPlacePreview | null,
  draft: string,
): AssistantSuggestion[] {
  if (place) {
    const rows: AssistantSuggestion[] = [
      { kind: 'show-details', label: 'Why it matters', placeId: place.id },
    ];
    if (place.lngLat) rows.push({ kind: 'nearby', label: "What's nearby", placeId: place.id });
    rows.push({ kind: 'show-on-map', label: 'Show on map', placeId: place.id });
    return rows;
  }
  if (draft.trim() === '') return [];
  return filterHarlemPlacePreviews(draft, 'All')
    .slice(0, 3)
    .map((match) => ({ kind: 'open-place', label: match.name, placeId: match.id }));
}

/**
 * The "What's nearby" answer (copy.md §4.5). Unmapped places get the honest
 * "isn't on the map yet" line instead of a distance from an unverified point.
 */
export function nearbyAnswer(place: HarlemPlacePreview, locale?: string): string {
  const near = nearbyPlaces(place.id, 3);
  if (near.length === 0) {
    return `${place.name} isn't on the map yet, so I can't tell you what's nearby.`;
  }
  const list = near.map(({ place: p, meters }) => `${p.name} (${formatDistance(meters, locale)})`);
  return `Closest on the map: ${list.join(', ')}.`;
}
