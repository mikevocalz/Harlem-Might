/** Native build facts shared with app.config; runtime method presence is not configuration. */
export interface NavigationArBuild {
  readonly provider: 'reactvision' | 'arcore';
  /** Set configured only together with the native ARCore SDK/key build configuration. */
  readonly earth: 'unconfigured' | 'arcore-configured';
}

/** This build configures ReactVision. ARCore Earth has no SDK/key opt-in. */
export const NAVIGATION_AR_BUILD: NavigationArBuild = {
  provider: 'reactvision',
  earth: 'unconfigured',
};

export function canUseNavigationEarth(build: NavigationArBuild): boolean {
  return build.provider === 'arcore' && build.earth === 'arcore-configured';
}
