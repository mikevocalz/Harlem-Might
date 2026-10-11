// Web fork — the browser has no unsafe areas; report zeroed insets.
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function useSafeAreaInsets(): SafeAreaInsets {
  return ZERO_INSETS;
}
