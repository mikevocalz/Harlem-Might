import { MapAttribution, MightsMapImage, type MapPin } from './MightsMapImage';
import { MightsFigure } from './MightsFigure';
import { MightsLocationStamp, type MightsLocationStampProps } from './MightsLocationStamp';
import { MightsNotchCard } from './MightsNotchCard';
import { MightsHeading, MightsText } from './MightsType';
import { routes } from './routes';

// Every bento in the product (register B1-B13 in docs/design/MIGHTS_REUSE_MATRIX.md).
// Routes pick a variant; spans live here and nowhere else. On md+ the grid is
// 12 columns with one dominant module; below md it is one column in source
// order, and the dominant module is always first in the source.

export interface BentoPlace {
  id: string;
  name: string;
  area: string;
  street?: string;
  shortDescription: string;
  lngLat?: readonly [number, number];
}

/** A place module: links to the place page. */
export interface BentoPlaceModule {
  kind: 'place';
  place: BentoPlace;
}

/** A sourced fact (distance, walk time, stop count). Compact strip and proof. */
export interface BentoFactModule {
  kind: 'fact';
  id: string;
  label: string;
  value: string;
  /** Source or qualifier line, e.g. "Measured along the route". */
  note?: string;
  href?: string;
}

/**
 * Anything else, composed from Mights primitives by the caller (an AR frame
 * with its status label, an archive item). The bento supplies the frame.
 */
export interface BentoCustomModule {
  kind: 'custom';
  id: string;
  content: React.ReactNode;
  href?: string;
}

export type BentoModule = BentoPlaceModule | BentoFactModule | BentoCustomModule;

/** Dominant static map for `map-dominant` (B2). One raster for the whole bento. */
export interface BentoMapLead {
  kind: 'map';
  center: readonly [number, number];
  zoom: number;
  pitch?: number;
  pins?: MapPin[];
  alt: string;
  caption?: string;
  /** Names the block or place the map shows; sits on the map's bottom-left edge. */
  stamp?: Pick<MightsLocationStampProps, 'name' | 'street' | 'href'>;
}

/** Dominant editorial image for `story-dominant` (B3, B8, B9). */
export interface BentoFigureLead {
  kind: 'figure';
  src: string;
  alt: string;
  /** Credit line for documentary or archival photographs. */
  caption?: string;
}

/** Dominant caller-composed module for `proof` (B4, B11). */
export interface BentoCustomLead {
  kind: 'custom';
  content: React.ReactNode;
}

export type BentoLead = BentoMapLead | BentoFigureLead | BentoCustomLead;

type BentoContent =
  | {
      /** Shorthand for `modules` that are all places. */
      places: readonly BentoPlace[];
      modules?: undefined;
    }
  | {
      modules: readonly BentoModule[];
      places?: undefined;
    };

type BentoLayout =
  | {
      /** Module 0 is dominant. Map card per place. B1, B5, B6, B10. */
      variant?: 'default';
      lead?: undefined;
    }
  | {
      /** One large map leads; modules are text-first, no per-module raster. B2. */
      variant: 'map-dominant';
      lead: BentoMapLead;
    }
  | {
      /** One editorial image leads; modules are text-first. B3, B8, B9. */
      variant: 'story-dominant';
      lead: BentoFigureLead;
    }
  | {
      /** A short strip of text modules, no media. Module 0 is widest. B7, B13. */
      variant: 'compact';
      lead?: undefined;
    }
  | {
      /** One proof item leads (usually the AR frame); modules support it. B4, B11. */
      variant: 'proof';
      lead: BentoLead;
    };

export type MightsPlaceBentoProps = BentoContent &
  BentoLayout & {
    /**
     * Heading level for module titles. 3 under a band's h2 (the default);
     * 2 when the bento sits directly under the page h1.
     */
    headingLevel?: 2 | 3;
    /**
     * Binds the bento to the site motion layer as one group reveal. Emits
     * `trg-bento-<key>` on the grid and `mfx-bento-<key>-<n>` on each module,
     * n = 0 for the dominant one (apps/web/components/site/motion-markers.ts).
     * Must be unique on the page.
     */
    motionKey?: string;
  };

/** Marker ids for a bento's motion group. Mirrors motion-markers.ts:bentoTriggerName/bentoModuleName. */
export function bentoMotionIds(key: string, moduleCount: number) {
  return {
    trigger: `trg-bento-${key}`,
    modules: Array.from({ length: moduleCount }, (_, i) => `mfx-bento-${key}-${i}`),
  };
}

// ---- spans ------------------------------------------------------------------
// Literal strings so Tailwind can read them. Uneven bays, never 4/4/4.

/** Dominant module: 7 columns, two rows, so it stays the largest at md+. */
const DOMINANT = 'md:col-span-7 md:row-span-2';
const BESIDE_DOMINANT = 'md:col-span-5';
/** Modules after the first row pair up 5/7, 7/5. An odd tail of three closes on 5/4/3; a lone tail takes the row. */
const AFTER = ['md:col-span-5', 'md:col-span-7'];
// md (768–1023) is too narrow for a 3-column card, so the tail goes 6/6/12 there.
const TAIL_OF_THREE = ['md:col-span-6 lg:col-span-5', 'md:col-span-6 lg:col-span-4', 'md:col-span-12 lg:col-span-3'];

/** The map lead spans as many rows as there are modules stacked beside it. */
const MAP_LEAD_ROWS = ['md:row-span-1', 'md:row-span-1', 'md:row-span-2', 'md:row-span-3'];
const MAP_LEAD = 'md:col-span-8';
const BESIDE_MAP = 'md:col-span-4';

const COMPACT: Record<number, readonly string[]> = {
  2: ['md:col-span-7', 'md:col-span-5'],
  3: ['md:col-span-5', 'md:col-span-4', 'md:col-span-3'],
  4: ['md:col-span-4', 'md:col-span-3', 'md:col-span-3', 'md:col-span-2'],
};

function afterSpan(i: number, total: number) {
  const rest = total - 3;
  if (rest % 2 === 1) {
    if (rest === 1) return 'md:col-span-12';
    const tailStart = total - 3;
    if (i >= tailStart) return TAIL_OF_THREE[i - tailStart]!;
  }
  return AFTER[(i - 3) % 2]!;
}

/** `sizes` for a map raster, matched to the module's md+ width. */
function sizesFor(span: string) {
  const vw = (bp: 'md' | 'lg') => {
    const cols = new RegExp(`${bp}:col-span-(\\d+)`).exec(span)?.[1];
    return cols ? Math.round((Number(cols) / 12) * 100) : undefined;
  };
  const md = vw('md') ?? 100;
  const lg = vw('lg') ?? md;
  return `(min-width: 1024px) ${lg}vw, (min-width: 768px) ${md}vw, 100vw`;
}

// ---- modules ----------------------------------------------------------------

/** Media well per module: a tall map, a short map, no media, or no media and one text line. */
type Media = 'map-dominant' | 'map' | 'none' | 'dense';

function moduleKey(m: BentoModule) {
  return m.kind === 'place' ? m.place.id : m.id;
}

function PlaceBody({ place, level, dominant, dense }: { place: BentoPlace; level: 2 | 3; dominant: boolean; dense: boolean }) {
  // The dominant card's map well takes the spare height, so its body stays content-sized.
  return (
    <div className={`flex flex-col gap-1 p-5 ${dominant ? '' : 'flex-1'}`}>
      <MightsHeading level={level} size={dominant ? 'title' : 'card'}>
        {place.name}
      </MightsHeading>
      <MightsText size="small">{place.street ?? place.area}</MightsText>
      {dense ? null : (
        <MightsText size="small" tone="default" className="mt-2">
          {place.shortDescription}
        </MightsText>
      )}
    </div>
  );
}

function PlaceMap({ place, media, span }: { place: BentoPlace; media: Media; span: string }) {
  if (media === 'none' || media === 'dense') return null;
  const well = media === 'map-dominant' ? 'h-64 md:min-h-80 md:flex-1' : 'h-40 md:h-44';
  return (
    <div className={`${well} shrink-0 border-b border-rule-hairline`}>
      {place.lngLat ? (
        <MightsMapImage
          center={place.lngLat}
          zoom={17.2}
          pitch={40}
          width={720}
          height={405}
          sizes={sizesFor(span)}
          pins={[{ lngLat: place.lngLat }]}
          alt={`Map of ${place.name}`}
        />
      ) : (
        <div className="flex h-full items-end bg-surface-sunken p-4">
          <MightsText size="small">Location pending</MightsText>
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  module,
  media,
  span,
  level,
  dominant,
}: {
  module: BentoModule;
  media: Media;
  span: string;
  level: 2 | 3;
  dominant: boolean;
}) {
  if (module.kind === 'place') {
    return (
      <MightsNotchCard href={routes.place(module.place.id)} label={module.place.name} className="flex-1">
        <PlaceMap place={module.place} media={media} span={span} />
        <PlaceBody place={module.place} level={level} dominant={dominant} dense={media === 'dense'} />
      </MightsNotchCard>
    );
  }
  if (module.kind === 'fact') {
    return (
      <MightsNotchCard href={module.href} label={`${module.label}: ${module.value}`} className="flex-1">
        <div className="flex flex-1 flex-col gap-1 p-5">
          {/* A fact is a label and a value, not a section: no heading, so a
              facts strip doesn't add four headings to the outline. */}
          <MightsText size="small">{module.label}</MightsText>
          <MightsText tone="default" className={`font-semibold ${dominant ? 'text-title-lg' : 'text-card'}`}>
            {module.value}
          </MightsText>
          {module.note ? (
            <MightsText size="small" className="mt-2">
              {module.note}
            </MightsText>
          ) : null}
        </div>
      </MightsNotchCard>
    );
  }
  return (
    <MightsNotchCard href={module.href} className="flex-1">
      {module.content}
    </MightsNotchCard>
  );
}

function LeadCard({ lead }: { lead: BentoLead }) {
  if (lead.kind === 'map') {
    return (
      <MightsNotchCard className="flex-1">
        <div className="relative h-72 shrink-0 md:h-auto md:min-h-96 md:flex-1">
          <MightsMapImage
            center={lead.center}
            zoom={lead.zoom}
            pitch={lead.pitch}
            width={1024}
            height={640}
            sizes={sizesFor(MAP_LEAD)}
            pins={lead.pins}
            alt={lead.alt}
          />
          {lead.stamp ? <MightsLocationStamp {...lead.stamp} className="absolute bottom-4 left-4" /> : null}
        </div>
        {lead.caption ? (
          <div className="border-t border-rule-hairline p-5">
            <MightsText size="small">{lead.caption}</MightsText>
          </div>
        ) : null}
      </MightsNotchCard>
    );
  }
  if (lead.kind === 'figure') {
    return <MightsFigure src={lead.src} alt={lead.alt} caption={lead.caption} />;
  }
  return <MightsNotchCard className="flex-1">{lead.content}</MightsNotchCard>;
}

// ---- component --------------------------------------------------------------

export function MightsPlaceBento(props: MightsPlaceBentoProps) {
  const { headingLevel = 3, motionKey } = props;
  const modules: readonly BentoModule[] =
    props.modules ?? props.places.map((place): BentoModule => ({ kind: 'place', place }));
  const hasLead = props.lead !== undefined;
  const ids = motionKey ? bentoMotionIds(motionKey, modules.length + (hasLead ? 1 : 0)) : undefined;

  type Cell = { key: string; span: string; node: React.ReactNode };
  const cells: Cell[] = [];

  if (props.variant === 'map-dominant' || props.variant === 'story-dominant' || props.variant === 'proof') {
    const mapLead = props.variant === 'map-dominant';
    const beside = mapLead ? BESIDE_MAP : BESIDE_DOMINANT;
    const stacked = Math.min(modules.length, mapLead ? 3 : 2);
    const leadSpan = mapLead ? `${MAP_LEAD} ${MAP_LEAD_ROWS[stacked]!}` : DOMINANT;
    cells.push({ key: 'lead', span: leadSpan, node: <LeadCard lead={props.lead} /> });
    modules.forEach((m, i) => {
      const span = i < stacked ? beside : mapLead ? BESIDE_MAP : afterSpan(i + 1, modules.length + 1);
      cells.push({
        key: moduleKey(m),
        span,
        node: <ModuleCard module={m} media="none" span={span} level={headingLevel} dominant={false} />,
      });
    });
  } else if (props.variant === 'compact') {
    const spans = COMPACT[modules.length] ?? COMPACT[4]!;
    modules.forEach((m, i) => {
      const span = spans[i % spans.length]!;
      cells.push({
        key: moduleKey(m),
        span,
        node: <ModuleCard module={m} media="dense" span={span} level={headingLevel} dominant={false} />,
      });
    });
  } else {
    modules.forEach((m, i) => {
      const span = i === 0 ? DOMINANT : i < 3 ? BESIDE_DOMINANT : afterSpan(i, modules.length);
      cells.push({
        key: moduleKey(m),
        span,
        node: (
          <ModuleCard
            module={m}
            media={i === 0 ? 'map-dominant' : 'map'}
            span={span}
            level={headingLevel}
            dominant={i === 0}
          />
        ),
      });
    });
  }

  const showsMap =
    props.lead?.kind === 'map' ||
    ((props.variant === undefined || props.variant === 'default') &&
      modules.some((m) => m.kind === 'place' && m.place.lngLat));

  return (
    <div className="flex flex-col gap-2">
      <div id={ids?.trigger} className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {cells.map((cell, i) => (
          <div key={cell.key} id={ids?.modules[i]} className={`flex flex-col ${cell.span}`}>
            {cell.node}
          </div>
        ))}
      </div>
      {showsMap ? <MapAttribution /> : null}
    </div>
  );
}
