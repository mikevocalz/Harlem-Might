'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { GeographicCoordinate } from '../model/geo';
import { navigationFixStore, useNavigationStore } from '../session/navigationStore';
import { directionsView, type DirectionsInput, type DirectionsView } from '../view/directionsView';
import { hudView, type HudView } from '../view/hudView';
import { useNavigationUi } from '../view/navigationUi.store';
import { devicePositionForPlanning } from '../view/runtime';

// A clock for ETAs before the first matched fix ("arrive around 5:28 PM").
// Read through useSyncExternalStore so render stays pure; it ticks every
// 30 s, which is finer than the minute the ETA prints.
const CLOCK_TICK_MS = 30_000;
let clockNow = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, CLOCK_TICK_MS);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
const readClock = () => clockNow;
function useClock(): number {
  return useSyncExternalStore(subscribeClock, readClock, readClock);
}

/** The low-frequency slices every navigation screen reads. Shallow, so a fix never re-renders a panel. */
function useNavigationSlices() {
  return useNavigationStore(
    useShallow((s) => ({ session: s.session, routeLoading: s.routeLoading, positioning: s.positioning, arTracking: s.arTracking, progress: s.progress })),
  );
}

/**
 * True once a device position usable for planning exists. A boolean, so the
 * panel re-renders when one first arrives, not on every fix.
 */
export function useHasDevicePosition(): boolean {
  return useStore(navigationFixStore, (s) => devicePositionForPlanning(s) !== undefined);
}

/** A catalogued place, as the panel needs it. */
export interface DirectionsPlace {
  readonly id: string;
  readonly name: string;
  readonly street?: string;
  readonly lngLat?: readonly [number, number];
}

const toCoordinate = (lngLat: readonly [number, number] | undefined): GeographicCoordinate | undefined =>
  lngLat ? { latitude: lngLat[1], longitude: lngLat[0] } : undefined;

/** The directions panel's view model for `place`. */
export function useDirectionsView(place: DirectionsPlace, originPlace: DirectionsPlace | undefined): DirectionsView {
  const state = useNavigationSlices();
  const ui = useNavigationUi(
    useShallow((s) => ({ mode: s.mode, originChoice: s.originChoice, location: s.location, online: s.online })),
  );
  const hasPosition = useHasDevicePosition();
  const now = useClock();
  return useMemo(() => {
    const input: DirectionsInput = {
      place: { id: place.id, name: place.name, coordinate: toCoordinate(place.lngLat), ...(place.street ? { street: place.street } : {}) },
      mode: ui.mode,
      originChoice: ui.originChoice,
      location: ui.location,
      online: ui.online,
      devicePosition: hasPosition ? devicePositionForPlanning(navigationFixStore.getState()) : undefined,
      ...(originPlace ? { originPlaceName: originPlace.name } : {}),
      now,
    };
    return directionsView(state, input, toCoordinate(originPlace?.lngLat));
  }, [state, ui, hasPosition, now, place.id, place.name, place.street, place.lngLat, originPlace]);
}

/** The guidance HUD's view model. */
export function useHudView(): HudView {
  const state = useNavigationSlices();
  const ui = useNavigationUi(useShallow((s) => ({ location: s.location, awarenessAcknowledged: s.awarenessAcknowledged })));
  const now = useClock();
  return useMemo(() => hudView(state, { ...ui, now }), [state, ui, now]);
}

/**
 * The place whose directions panel should show: the session's destination
 * once it has one, else the place the panel was opened for.
 */
export function useDirectionsPlaceId(): string | null {
  const sessionPlace = useNavigationStore((s) =>
    'destination' in s.session ? (s.session.destination.placeId ?? null) : s.session.phase === 'error' ? (s.session.trip?.destination.placeId ?? null) : null,
  );
  const opened = useNavigationUi((s) => s.directionsPlaceId);
  return sessionPlace ?? opened;
}

/** True while a trip is being followed (guiding, rerouting, paused or arrived). */
export function useIsGuiding(): boolean {
  return useNavigationStore((s) => 'activeRoute' in s.session);
}
