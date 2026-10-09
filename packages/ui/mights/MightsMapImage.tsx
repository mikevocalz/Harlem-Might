import { Image } from '../Image';
import { Link } from '../html';
import { Text, View } from '../tw';
import { buildMapboxStaticUrl } from './mapbox-static';

// A live Mapbox Static Images render of a real place — the sanctioned stand-in
// wherever a cleared photograph does not exist yet. The classic satellite style
// is used because Static Images cannot render Mapbox Standard or Standard
// Satellite; it gives cards real aerial imagery while Explore GL uses Standard.

// Literal reads so Next and Metro each inline their own.
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export interface MapPin {
  lngLat: readonly [number, number];
  tone?: 'cobalt' | 'live' | 'iron';
}

export interface MightsMapImageProps {
  center: readonly [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
  /** Requested pixel size (rendered @2x). Mapbox caps each side at 1280. */
  width: number;
  height: number;
  pins?: MapPin[];
  alt: string;
  className?: string;
  priority?: boolean;
  /**
   * Candidate widths for a responsive `srcset` (device-pixel widths at the
   * element's rendered size, not the request size). When set, `sizes` should
   * describe the layout width so phones don't pull a 1280px desktop frame.
   */
  sizes?: string;
}


export function mapboxStaticUrl(props: Omit<MightsMapImageProps, 'alt'>) {
  return buildMapboxStaticUrl(TOKEN, props);
}

/**
 * Responsive candidates at half, full and 1.5x the requested frame — the
 * map is the same view at each width, so only the raster size changes.
 * Exported so pages can pair it with a matching `<link rel="preload">`
 * (`imagesrcset`/`imagesizes`) without duplicating the URL builder.
 */
export function mapboxStaticSrcSet(props: Omit<MightsMapImageProps, 'alt' | 'className' | 'priority' | 'sizes'>) {
  const { width, height } = props;
  const scales = [0.5, 1, 1.5] as const;
  const entries = scales
    .map((s) => {
      // Mapbox caps each side at 1280 — scale the frame proportionally so
      // the candidate keeps the requested aspect ratio.
      const cap = Math.min(1, 1280 / (width * s), 1280 / (height * s));
      const w = Math.round(width * s * cap);
      const h = Math.round(height * s * cap);
      const url = mapboxStaticUrl({ ...props, width: w, height: h });
      // Descriptor is the delivered pixel width (@2x request doubles it).
      return url ? `${url} ${w * 2}w` : null;
    })
    .filter((e): e is string => e !== null);
  return [...new Set(entries)].join(', ');
}

export function MightsMapImage(props: MightsMapImageProps) {
  const { alt, className = '', priority, sizes } = props;
  const src = mapboxStaticUrl(props);
  if (!src) {
    return (
      <View
        role="img"
        aria-label={`${alt} (map unavailable)`}
        className={`h-full w-full justify-end bg-surface-sunken p-4 ${className}`}
      >
        <Text className="text-label text-text-muted">Map unavailable: no Mapbox token configured</Text>
      </View>
    );
  }
  // The kit Image: next/image on web (sized by `sizes`), expo-image on native.
  return (
    <View className={`h-full w-full overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes ?? '100vw'} className="h-full w-full" />
    </View>
  );
}

const CREDITS = [
  ['Mapbox', 'https://www.mapbox.com/about/maps/'],
  ['OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
  ['Maxar', 'https://www.maxar.com/'],
] as const;

/** Mapbox, OpenStreetMap and satellite-imagery attribution required by this style. */
export function MapAttribution({ className = '' }: { className?: string }) {
  return (
    <Text className={`text-caption text-text-muted ${className}`}>
      {CREDITS.map(([name, url], i) => (
        <Text key={name}>
          {i ? ' ' : ''}©{' '}
          <Link className="hover:underline" href={url} target="_blank" rel="noreferrer">
            {name}
          </Link>
        </Text>
      ))}
    </Text>
  );
}
