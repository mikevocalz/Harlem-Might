import { palette, semantic } from '@acme/theme';
import type { MightsMapImageProps } from './MightsMapImage';

// The Static Images URL, shared by the web and native MightsMapImage; each
// passes its own token (NEXT_PUBLIC_ on web, EXPO_PUBLIC_ on native).
const STYLE = 'mapbox/satellite-streets-v12';

// Mapbox overlay colours are bare hex: brand gold, live red, warm off-white.
const hex = (c: string) => c.replace('#', '').toLowerCase();
const PIN_COLOR = {
  cobalt: hex(palette.mights.gold),
  live: hex(semantic.accent.dark),
  iron: hex(semantic.text.dark),
} as const;

export function buildMapboxStaticUrl(
  token: string | undefined,
  { center, zoom, pitch = 0, bearing = 0, width, height, pins = [] }: Omit<MightsMapImageProps, 'alt'>,
) {
  if (!token) return null;
  const overlay = pins
    .map((p) => `pin-s+${PIN_COLOR[p.tone ?? 'cobalt']}(${p.lngLat[0]},${p.lngLat[1]})`)
    .join(',');
  const w = Math.min(1280, Math.round(width));
  const h = Math.min(1280, Math.round(height));
  return (
    `https://api.mapbox.com/styles/v1/${STYLE}/static/` +
    (overlay ? `${overlay}/` : '') +
    `${center[0]},${center[1]},${zoom},${bearing},${pitch}/${w}x${h}@2x` +
    `?attribution=false&logo=true&access_token=${token}`
  );
}
