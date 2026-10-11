export interface NavigationDevice {
  isHorizon: boolean;
  isFoldable: boolean;
  isTablet: boolean;
  hardwareColumnWidth: number;
}

/** Device family owns navigation. A narrow foldable remains a foldable. */
export function navigationPresentation(device: NavigationDevice) {
  const rail = device.isHorizon || device.isFoldable || device.isTablet || device.hardwareColumnWidth > 0;
  return { rail, position: rail ? 'right' as const : 'bottom' as const };
}
