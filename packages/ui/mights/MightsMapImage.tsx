import { palette, semantic } from '@acme/theme';

// A live Mapbox Static Images render of a real place — the sanctioned stand-in
// wherever a cleared photograph does not exist yet. Without a token it renders
// an honest, labelled empty plate; never a gradient.

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = 'mapbox/dark-v11';

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


// Mapbox overlay colours are bare hex: brand gold, live red, warm off-white.
const hex = (c: string) => c.replace('#', '').toLowerCase();
const PIN_COLOR = {
  cobalt: hex(palette.mights.gold),
  live: hex(semantic.accent.dark),
  iron: hex(semantic.text.dark),
} as const;

export function mapboxStaticUrl({ center, zoom, pitch = 0, bearing = 0, width, height, pins = [] }: Omit<MightsMapImageProps, 'alt'>) {
  if (!TOKEN) return null;
  const overlay = pins
    .map((p) => `pin-s+${PIN_COLOR[p.tone ?? 'cobalt']}(${p.lngLat[0]},${p.lngLat[1]})`)
    .join(',');
  const w = Math.min(1280, Math.round(width));
  const h = Math.min(1280, Math.round(height));
  return (
    `https://api.mapbox.com/styles/v1/${STYLE}/static/` +
    (overlay ? `${overlay}/` : '') +
    `${center[0]},${center[1]},${zoom},${bearing},${pitch}/${w}x${h}@2x` +
    `?attribution=false&logo=false&access_token=${TOKEN}`
  );
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
  const srcSet = sizes ? mapboxStaticSrcSet(props) : undefined;
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${alt} (map unavailable)`}
        className={`flex h-full w-full items-end bg-surface-sunken p-4 text-label text-text-muted ${className}`}
      >
        Map unavailable: no Mapbox token configured
      </div>
    );
  }
  return (
    // Plain <img>, not next/image: this package lints outside the Next plugin
    // and Mapbox already serves sized @2x rasters.
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={props.width}
      height={props.height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={`block h-full w-full object-cover ${className}`}
    />
  );
}

/** Mapbox and OpenStreetMap attribution, required wherever a map renders. */
export function MapAttribution({ className = '' }: { className?: string }) {
  return (
    <span className={`text-caption text-text-muted ${className}`}>
      © <a className="hover:underline" href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a>{' '}
      © <a className="hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
    </span>
  );
}
