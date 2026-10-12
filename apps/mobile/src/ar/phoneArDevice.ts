/** Stable capability evidence accepted by the existing native navigation shell. */
export interface PhoneArDeviceInput {
  readonly platform: string;
  readonly isPad?: boolean;
  readonly androidCapabilities?: { readonly isFoldable: boolean; readonly isTablet: boolean };
  /** A measured Apple hardware column, retained after it has first appeared. */
  readonly hasHardwareColumn: boolean;
}

/**
 * The current full-screen walking HUD is limited to ordinary phones. The app
 * has no live fold-feature bounds bridge, so it cannot promise hinge-safe AR
 * controls or preserve a rail through this root route on other families.
 * Missing Android capability evidence is unknown, never an ordinary phone.
 * The existing Android bridge's device-family detection gaps still apply.
 */
export function supportsPhoneArLayout(input: PhoneArDeviceInput): boolean {
  if (input.hasHardwareColumn) return false;
  if (input.platform === 'ios') return input.isPad === false;
  if (input.platform !== 'android') return false;
  const capabilities = input.androidCapabilities;
  return capabilities?.isFoldable === false && capabilities.isTablet === false;
}
