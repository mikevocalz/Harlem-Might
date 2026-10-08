/**
 * The Mapbox token a client bundle may hold. Only public `pk.` tokens belong
 * in a client; secret `sk.` tokens are refused rather than sent.
 */
export type MapboxTokenState =
  | { readonly kind: 'public'; readonly token: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'not-public' };

/** Classifies one raw token value. */
export function parseMapboxToken(raw: string | undefined): MapboxTokenState {
  const token = raw?.trim() ?? '';
  if (!token) return { kind: 'missing' };
  if (!token.startsWith('pk.')) return { kind: 'not-public' };
  return { kind: 'public', token };
}

/**
 * The token from the environment: `EXPO_PUBLIC_MAPBOX_TOKEN` on native,
 * `NEXT_PUBLIC_MAPBOX_TOKEN` on web. Both bundlers inline these only when
 * read as a literal `process.env.NAME`, which is why they are read here and
 * nowhere else in the feature.
 */
export function mapboxTokenFromEnv(): MapboxTokenState {
  const expo = parseMapboxToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);
  if (expo.kind !== 'missing') return expo;
  return parseMapboxToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
}
