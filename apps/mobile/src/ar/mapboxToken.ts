/**
 * The Mapbox token the app bundle may hold. Only public `pk.` tokens belong
 * in a client; anything else is refused rather than sent.
 */
export type MapboxTokenState =
  | { readonly kind: 'public'; readonly token: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'not-public' };

/** Classifies a raw token value. */
export function parseMapboxToken(raw: string | undefined): MapboxTokenState {
  const token = raw?.trim() ?? '';
  if (!token) return { kind: 'missing' };
  if (!token.startsWith('pk.')) return { kind: 'not-public' };
  return { kind: 'public', token };
}

/**
 * The app's Mapbox token from `EXPO_PUBLIC_MAPBOX_TOKEN`. Expo inlines the
 * value at bundle time only when it is read as `process.env.EXPO_PUBLIC_*`
 * directly, which is why this reads it here and nowhere else.
 */
export function mapboxToken(): MapboxTokenState {
  return parseMapboxToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);
}
