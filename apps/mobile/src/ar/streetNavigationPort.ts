import type { GeographicCoordinate, RouteLeg } from '@mapbox/react-native-mapbox-ar/navigation';

/**
 * What the street scene needs from the shared NavigationSession
 * (packages/app/features/navigation). The scene presents the session; it
 * never fetches routes or keeps its own navigation state. The session owner
 * implements this port with a selector over its store.
 */

/**
 * A headset has no GPS, so the route starts at a point the wearer chose by
 * hand: where they stand, or a place they jumped to. The label is shown with
 * the route so nobody mistakes it for a located position.
 */
export interface ManualOrigin {
  readonly kind: 'manual';
  readonly coordinate: GeographicCoordinate;
  readonly label: string;
}

/** The session states the street scene presents. */
export type StreetNavigationView =
  | {
      /** The session is not wired into this build; the scene hides route controls. */
      readonly status: 'unavailable';
      readonly reason: string;
    }
  | { readonly status: 'idle' | 'selectingDestination' }
  | { readonly status: 'calculatingRoute' | 'rerouting'; readonly destinationId: string }
  | {
      readonly status: 'routeReady' | 'navigating' | 'paused';
      readonly destinationId: string;
      readonly origin: ManualOrigin;
      readonly legs: readonly RouteLeg[];
      /** Full route line, for the ribbon on the ground. */
      readonly geometry: readonly GeographicCoordinate[];
      /** Index into the legs' steps, flattened in travel order. */
      readonly stepIndex: number;
    }
  | { readonly status: 'arrived'; readonly destinationId: string }
  | { readonly status: 'error'; readonly message: string };

/** Commands the street scene sends; each is a press the wearer made. */
export interface StreetNavigationCommands {
  /** Walking route from a manual origin to a place (Mapbox walking, steps on). */
  requestRoute(input: { readonly destinationId: string; readonly origin: ManualOrigin }): void;
  /** Begins guidance on a ready route at its first step. */
  start(): void;
  /**
   * Simulated progress: the wearer moved to the stance of step `index` (a
   * manual-origin session has no location fixes to derive it from).
   */
  goToStep(index: number): void;
  end(): void;
}

export interface StreetNavigationPort {
  readonly view: StreetNavigationView;
  readonly commands: StreetNavigationCommands;
}
