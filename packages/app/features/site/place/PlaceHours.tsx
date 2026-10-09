import type { PlaceRecord } from '@acme/app/content';
import { Badge } from '@acme/ui';
import { Link } from '@acme/ui/html';
import { MightsHeading, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { WEEKDAYS, formatDay, harlemClock, isOpenAt, parseOpeningHours } from './opening-hours.ts';

const link = 'mights-focus text-primary underline underline-offset-4 hover:no-underline';

const checkedOn = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' });

/**
 * The weekly hours table with an open-now badge in Harlem time. Hours the
 * parser can't read show as the source wrote them. Unchecked hours say so
 * next to the table rather than being hidden.
 */
export function PlaceHours({ hours, now }: { hours: NonNullable<PlaceRecord['openingHours']>; now: Date }) {
  const week = hours.osm ? parseOpeningHours(hours.osm) : null;
  const { day, minute } = harlemClock(now);
  const open = week ? isOpenAt(week, day, minute) : null;

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-3">
        <MightsHeading level={3} size="card">
          Hours
        </MightsHeading>
        {open === null ? null : <Badge label={open ? 'Open now' : 'Closed now'} tone={open ? 'success' : 'neutral'} />}
      </View>
      {week ? (
        <View role="list" aria-label="Opening hours by day" className="border-t border-rule-hairline">
          {WEEKDAYS.map((name, i) => {
            const today = i === day;
            return (
              <View
                key={name}
                role="listitem"
                className={`flex-row justify-between gap-4 border-b border-rule-hairline py-2 ${today ? 'bg-surface-sunken px-2' : ''}`}
              >
                <MightsText size="small" tone={today ? 'default' : 'muted'} className={today ? 'font-semibold' : ''}>
                  {today ? `${name} (today)` : name}
                </MightsText>
                <MightsText size="small" tone={today ? 'default' : 'muted'} className="text-right">
                  {formatDay(week[i] ?? [])}
                </MightsText>
              </View>
            );
          })}
        </View>
      ) : hours.osm || hours.note ? (
        <MightsText size="small" tone="default">
          {hours.osm ?? hours.note}
        </MightsText>
      ) : null}
      {hours.osm && hours.note ? <MightsText size="small">{hours.note}</MightsText> : null}
      <MightsText size="small">
        {/* verifiedAt is when the import read the source, not a call to the place. */}
        {hours.verifiedAt
          ? `From OpenStreetMap, read ${checkedOn(hours.verifiedAt)}. Not checked with the place. `
          : 'From OpenStreetMap. Not checked with the place. '}
        {hours.sourceUrl ? (
          <Link href={hours.sourceUrl} target="_blank" rel="noreferrer" className={link}>
            Source
          </Link>
        ) : null}
      </MightsText>
    </View>
  );
}
