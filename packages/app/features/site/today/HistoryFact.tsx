import { harlemHistoryFactFor } from '@acme/app/content';
import { Link, Section, Time } from '@acme/ui/html';
import { MightsHeading, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';

const longDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });

/**
 * The dated moment from Harlem's past that opens Today. Says "On this day"
 * only when the month and day match; otherwise the date leads, so a nearby
 * anniversary never reads as today's.
 *
 * @param date `YYYY-MM-DD` in America/New_York (`harlemToday()`).
 */
export function HistoryFact({ date }: { date: string }) {
  const { fact, onThisDay } = harlemHistoryFactFor(date);
  const when = longDate.format(new Date(`${fact.date}T00:00:00Z`));
  return (
    <Section aria-labelledby="history-fact" className="border-l-2 border-primary pl-5">
      <View className="max-w-content-detail gap-3">
        <MightsText size="small" className="font-semibold uppercase tracking-[0.16em] text-primary">
          {onThisDay ? 'On this day in Harlem' : 'From Harlem’s past'}
        </MightsText>
        <MightsHeading level={2} size="title" id="history-fact">
          <Time dateTime={fact.date}>{when}</Time>
        </MightsHeading>
        <MightsText tone="default">{fact.text}</MightsText>
        <MightsText size="small">
          Source:{' '}
          <Link href={fact.sourceUrl} target="_blank" rel="noreferrer" className="mights-focus text-primary underline underline-offset-4 hover:no-underline">
            {fact.sourceLabel}
          </Link>
        </MightsText>
      </View>
    </Section>
  );
}
