import { useRouter } from 'solito/navigation';
import { routes } from '@acme/ui/mights';
import { todayHeading } from '@acme/app/features/site/today/event-format.ts';
import { ContentNotice, SiteAction, SitePage } from './SitePage';

// Walks, Stories and Today on native.
//
// DEFER (2026-10-08): no native content reader. The site reads these through
// `@acme/payload/server` (listWalks, listStories, listEventsForDate), which is
// bound to Payload's Local API and is server-only. The reader contract in
// `@acme/app/content` (createContentReaders + a ContentSource) is portable,
// but the app has no ContentSource yet: a REST one over the site's
// `/payload-api` mount needs (1) the anonymous REST access rules verified for
// published docs, (2) the `where` clause encoded the way Payload's REST parser
// expects, and (3) a site URL a headset can reach (EXPO_PUBLIC_APP_URL is
// localhost in development). Until then each screen shows the site's empty
// copy. That claim rests on the repo, not on a read: D9 records that no story
// records exist, the site's Walks page is empty, and no event ingest exists
// (only an EVENTS_SCRAPER_USER_AGENT env default in packages/config). If any
// of those changes before the reader ships, this copy becomes false: replace
// it with "isn't in the app yet" copy that links to the site. When the reader
// lands, render all three of the site's
// states from its ContentResult: `ok` with rows, `ok` and empty (this copy),
// and `unavailable` ("We couldn't check ... right now" plus Try again). Never
// show the empty copy for a failed read.

function OpenTheMap() {
  const router = useRouter();
  return <SiteAction label="Open the map" onPress={() => router.push(routes.explore())} />;
}

export function WalksScreen() {
  return (
    <SitePage
      title="Walks"
      lead="Take the long way. Walks connect places into a story without turning the neighborhood into a checklist."
    >
      <ContentNotice title="No walks published yet" actions={<OpenTheMap />}>
        The first routes are being researched now. Until they are published, start from a place on the map and walk out
        from there.
      </ContentNotice>
    </SitePage>
  );
}

// Same heading as the site's Today page: shared in event-format.ts, and the
// date is Harlem's, never the device's time zone.
export function TodayScreen() {
  return (
    <SitePage
      title={`Today in Harlem, ${todayHeading(new Date())}`}
      lead="Events with a date and a source, and when we last checked each one."
    >
      <ContentNotice title="No events listed for today" actions={<OpenTheMap />}>
        Venue listings appear here once we’ve checked them. Start from a place on the map instead.
      </ContentNotice>
    </SitePage>
  );
}
