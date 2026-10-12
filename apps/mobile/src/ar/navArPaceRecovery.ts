import type { NavigationSession } from '@acme/app/features/navigation/model/session.ts';
import type { LocationAvailability } from '@acme/app/features/navigation/view/locationSource.ts';
import { useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { locationSource, startLocation } from '@acme/app/features/navigation/view/runtime.ts';

/** A paused device-origin trip may recheck permission, including after Settings changes. */
export function canCheckWalkingPace(input: { session: NavigationSession }): boolean {
  return input.session.phase === 'paused' && input.session.origin.kind === 'device-location';
}

function hasLocationGrant(location: LocationAvailability): boolean {
  return location === 'granted' || location === 'approximate';
}

/**
 * Refreshes GPS while staying paused. Permission is checked without requesting
 * it, then the exact trip and foreground lifetime are revalidated after await.
 * The shared runtime keeps repeated recovery presses to one position watch.
 */
export async function checkWalkingPace(isForeground: () => boolean): Promise<boolean> {
  const session = useNavigationStore.getState().session;
  if (!isForeground() || !canCheckWalkingPace({ session })) return false;
  const source = locationSource();
  const permissionSnapshot = useNavigationUi.getState();
  try {
    const availability = await source.check();
    if (!isForeground() || useNavigationStore.getState().session !== session || locationSource() !== source) return false;
    // An unchanged cached denial may have been repaired in Settings. A newer
    // non-grant snapshot still wins over this read, including repeated denials
    // with the same value. Unrelated non-grant updates conservatively retry.
    const currentPermission = useNavigationUi.getState();
    if (currentPermission !== permissionSnapshot && !hasLocationGrant(currentPermission.location)) return false;
    useNavigationUi.getState().setLocation(availability);
    if (!hasLocationGrant(availability)) return false;
    startLocation();
    return true;
  } catch {
    return false;
  }
}
