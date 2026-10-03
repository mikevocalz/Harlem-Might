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

export function MightsMapImage(props: MightsMapImageProps) {
  const { alt, className = '', priority } = props;
  const src = mapboxStaticUrl(props);
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${alt} (map unavailable)`}
        className={`flex h-full w-full items-end bg-surface-sunken p-4 text-[13px] text-text-muted ${className}`}
      >
        Map unavailable: no Mapbox token configured
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Mapbox serves sized @2x rasters already
    <img
      src={src}
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
    <span className={`text-[11px] text-text-muted ${className}`}>
      © <a className="hover:underline" href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a>{' '}
      © <a className="hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
    </span>
  );
}
