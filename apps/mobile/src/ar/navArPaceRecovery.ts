import type { NavigationSession } from '@acme/app/features/navigation/model/session.ts';
import type { LocationAvailability } from '@acme/app/features/navigation/view/locationSource.ts';
import { useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { locationSource, startLocation } from '@acme/app/features/navigation/view/runtime.ts';

/** Pace recovery may observe an already-authorized device-origin paused trip. */
export function canCheckWalkingPace(input: { session: NavigationSession; location: LocationAvailability }): boolean {
  return input.session.phase === 'paused' && input.session.origin.kind === 'device-location' &&
    (input.location === 'granted' || input.location === 'approximate');
}

/**
 * Refreshes GPS while staying paused. Permission is checked without requesting
 * it, then the exact trip and foreground lifetime are revalidated after await.
 * The shared runtime keeps repeated recovery presses to one position watch.
 */
export async function checkWalkingPace(isForeground: () => boolean): Promise<boolean> {
  const session = useNavigationStore.getState().session;
  if (!isForeground() || !canCheckWalkingPace({ session, location: useNavigationUi.getState().location })) return false;
  const source = locationSource();
  try {
    const availability = await source.check();
    if (!isForeground() || useNavigationStore.getState().session !== session || locationSource() !== source) return false;
    // A newer denial event wins over a slower permission-read result.
    if (!canCheckWalkingPace({ session, location: useNavigationUi.getState().location })) return false;
    useNavigationUi.getState().setLocation(availability);
    if (!canCheckWalkingPace({ session, location: availability })) return false;
    startLocation();
    return true;
  } catch {
    return false;
  }
}
