import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { SpatialWindowOwnersProps } from './SpatialWindowOwnersProps';

/**
 * A container that gives the Android window it lands in the host activity's
 * lifecycle, saved-state, view-model-store and back-dispatcher owners, so
 * Jetpack Compose views (`@expo/ui`) inside a promoted Meta spatial window can
 * attach. Owners the window already has are kept.
 */
export const SpatialWindowOwners: ComponentType<SpatialWindowOwnersProps> =
  requireNativeView<SpatialWindowOwnersProps>('SpatialWindowOwners');
