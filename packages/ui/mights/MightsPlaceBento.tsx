import { MapAttribution, MightsMapImage } from './MightsMapImage';
import { MightsNotchCard } from './MightsNotchCard';
import { MightsHeading, MightsText } from './MightsType';
import { routes } from './routes';

export interface BentoPlace {
  id: string;
  name: string;
  area: string;
  street?: string;
  shortDescription: string;
  lngLat?: readonly [number, number];
}

// Uneven bay rhythm, never 4/4/4. One fixed map height so a row always matches.
const SPANS = ['md:col-span-7', 'md:col-span-5', 'md:col-span-5', 'md:col-span-7', 'md:col-span-7', 'md:col-span-5'];
const THREE = ['md:col-span-5', 'md:col-span-4', 'md:col-span-3'];

export function MightsPlaceBento({ places }: { places: readonly BentoPlace[] }) {
  const spans = places.length === 3 ? THREE : SPANS;
  return (
    <div className="flex flex-col gap-2">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      {places.map((place, i) => (
        <MightsNotchCard
          key={place.id}
          href={routes.place(place.id)}
          label={place.name}
          className={spans[i % spans.length]}
        >
          <div className="h-56 shrink-0 border-b border-rule-hairline md:h-64">
            {place.lngLat ? (
              <MightsMapImage
                center={place.lngLat}
                zoom={17.2}
                pitch={40}
                width={720}
                height={405}
                pins={[{ lngLat: place.lngLat }]}
                alt={`Map of ${place.name}`}
              />
            ) : (
              <div className="flex h-full items-end bg-surface-sunken p-4 text-[13px] text-text-muted">
                Location pending
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-5">
            <MightsHeading level={3} size="card">
              {place.name}
            </MightsHeading>
            <MightsText size="small">{place.street ?? place.area}</MightsText>
            <MightsText size="small" tone="default" className="mt-2">
              {place.shortDescription}
            </MightsText>
          </div>
        </MightsNotchCard>
      ))}
    </div>
    <MapAttribution />
    </div>
  );
}
