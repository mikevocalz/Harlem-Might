import { useNavAr } from './navAr.store';

let cameraOwner: symbol | undefined;

/**
 * Placement belongs to one native Viro world origin, not its persistent HUD or
 * Explore host. Bind this to the camera child's layout effect so hiding and
 * restarting that child both discard all evidence before fresh calibration.
 * The shared walking session and location watch are deliberately untouched.
 */
export function attachNavigationArCamera(): () => void {
  const owner = Symbol('navigation-ar-camera');
  cameraOwner = owner;
  useNavAr.getState().reset();
  return () => {
    if (cameraOwner !== owner) return;
    cameraOwner = undefined;
    useNavAr.getState().reset();
  };
}
