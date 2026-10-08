import type { WalkStop } from '@acme/app/content';
import { MightsHeading, MightsNotchCard, MightsText } from '@acme/ui/mights';
import { linkPlace } from '../content/place-link';
import { stopAnchor } from './walk-facts';

// The stop sequence. An ordered list, never a bento: order is the content.
// Each stop links to its place page (a stop has no page of its own) and
// carries an #stop-n anchor for in-walk position. No checkboxes or progress:
// a walk is an outing, not a checklist.

function StopBody({ stop }: { stop: WalkStop }) {
  const linked = linkPlace(stop.place);
  const name = stop.place?.name ?? 'This stop is no longer in the catalogue';
  const street = linked ? (linked.preview.street ?? linked.preview.area) : null;
  return (
    <div className="flex gap-5 p-5">
      {/* The <ol> already announces the position; the numeral is visual only. */}
      <span aria-hidden className="w-10 shrink-0 font-sans text-title-lg font-bold text-primary tabular-nums">
        {stop.position}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <MightsHeading level={3} size="card">
          {name}
        </MightsHeading>
        {street ? <MightsText size="small">{street}</MightsText> : null}
        {stop.note ? (
          <MightsText size="small" tone="default" className="mt-2">
            {stop.note}
          </MightsText>
        ) : null}
      </div>
    </div>
  );
}

export function WalkStops({ stops }: { stops: readonly WalkStop[] }) {
  return (
    <section aria-labelledby="stops" className="flex max-w-content-screen flex-col gap-6">
      <MightsHeading level={2} size="display-md" id="stops">
        Stops
      </MightsHeading>
      <ol className="flex flex-col gap-4">
        {stops.map((stop) => {
          const linked = linkPlace(stop.place);
          return (
            <li key={stop.position} id={stopAnchor(stop.position)} className="flex scroll-mt-24 flex-col">
              {linked ? (
                <MightsNotchCard href={linked.href}>
                  <StopBody stop={stop} />
                </MightsNotchCard>
              ) : (
                <MightsNotchCard>
                  <StopBody stop={stop} />
                </MightsNotchCard>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
