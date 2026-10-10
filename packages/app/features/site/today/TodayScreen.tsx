import { getHarlemArchivalImage, type EventRecord } from "@acme/app/content";
import { MightsButton, MightsPage, MightsText, routes } from "@acme/ui/mights";
import { ContentNotice } from "../content/ContentNotice.tsx";
import type { ScreenResult } from "../stories/StoriesScreen.tsx";
import { HistoryFact } from "./HistoryFact.tsx";
import { TodayEvents } from "./TodayEvents.tsx";
import { todayHeading } from "./event-format.ts";
import { ContentLoader } from "@acme/app/features/site/content/ContentLoader.tsx";

const archiveImage = getHarlemArchivalImage("nypl-lenox-market-1939");

/** Today's Harlem events, shared by the site page and app tab. */
export function TodayScreen({
  date,
  now,
  result,
}: {
  date: string;
  now: Date;
  result: ScreenResult<readonly EventRecord[]> | undefined;
}) {
  let body;
  if (!result) body = <ContentLoader label="Checking for events today" />;
  else if (result.status === "unavailable") {
    body = (
      <ContentNotice
        title="We couldn’t check for events right now"
        image={archiveImage}
        actions={
          <>
            <MightsButton href={routes.today()}>Try again</MightsButton>
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </>
        }
      >
        Our records didn’t answer, so we can’t say what’s on today. Try again in
        a moment, or check the venue’s own site.
      </ContentNotice>
    );
  } else if (result.data.length === 0) {
    body = (
      <ContentNotice
        title="No events listed for today"
        image={archiveImage}
        actions={
          <MightsButton href={routes.explore()}>Open the map</MightsButton>
        }
      >
        Venue listings appear here once we’ve checked them. Start from a place
        on the map instead.
      </ContentNotice>
    );
  } else body = <TodayEvents events={result.data} now={now} />;

  return (
    <MightsPage
      title={`Today in Harlem, ${todayHeading(now)}`}
      lead="Events with a date and a source, and when we last checked each one."
    >
      <HistoryFact date={date} />
      {body}
    </MightsPage>
  );
}
