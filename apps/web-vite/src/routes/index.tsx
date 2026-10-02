/**
 * `/` — the landing page. The GridScene canvas is the hero backdrop (the same
 * Skia scene the app boots into), the hero copy sits on top of it, and the
 * "From the CMS" rail renders whatever the `pages` collection has published —
 * the honest empty/offline states are part of the design, not errors.
 *
 * SOT-KEYWORDS: web-vite landing hero gridscene payload pages rail
 */
import { Link, createFileRoute } from '@tanstack/react-router';
import { GridScene, Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';
import { listPages, type CmsStatus } from '@/lib/payload';
import { PageCard } from '@/components/page-card';
import { CmsOffline } from '@/components/cms-offline';

const TITLE = 'Harlem Might — a universal spatial app';
const DESCRIPTION =
  'One codebase for screens, spatial windows and WebXR — Expo SDK 58, Next.js, Skia, Rive and Viro/OpenXR.';

export const Route = createFileRoute('/')({
  loader: () => listPages(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { pages, status } = Route.useLoaderData();

  return (
    <Main className="flex-1">
      {/* Hero — the grid scene, content overlaid */}
      <View className="relative min-h-[70vh] overflow-hidden">
        <View className="absolute inset-0">
          <GridScene
            className="flex-1"
            horizon={0.44}
            gap={0}
            speed={0.6}
            lineColor="#00f3ff"
            glowColor="#00f3ff"
            backgroundColor="#050505"
            opacity={0.88}
            showCeiling={false}
          />
        </View>
        <Section className="relative mx-auto w-full max-w-4xl gap-5 px-6 py-24">
          <Text className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
            Harlem Might / Site 01
          </Text>
          <Heading level={1} size="display-lg" className="text-white">
            Built for screens, spatial windows and headsets.
          </Heading>
          <Text className="max-w-2xl text-base leading-relaxed text-cyan-100/60">
            Expo SDK 58 and Next.js sharing one codebase through Solito — Skia for
            universal GPU scenes, Rive for animated surfaces, and Viro/OpenXR for
            the immersive world. Content below is served live from Payload 4.
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-3">
            <a
              href="http://localhost:3000"
              className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition-colors duration-150 hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              Open the app
            </a>
            <Link
              to="/pages"
              className="rounded-md border border-white/15 px-5 py-3 text-sm font-semibold text-cyan-50/80 transition-colors duration-150 hover:border-cyan-400/40 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              Read the content
            </Link>
          </View>
        </Section>
      </View>

      {/* CMS rail */}
      <Section className="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-16 sm:px-6">
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
            From the CMS
          </Text>
          <Heading level={2} size="display-sm" className="text-white">
            Published pages
          </Heading>
        </View>
        <CmsRail pages={pages} status={status} />
      </Section>
    </Main>
  );
}

function CmsRail({
  pages,
  status,
}: {
  pages: Awaited<ReturnType<typeof listPages>>['pages'];
  status: CmsStatus;
}) {

  if (!status.ok) return <CmsOffline detail={status.detail} />;
  if (pages.length === 0) {
    return (
      <View className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-6 py-10">
        <Text className="text-sm text-cyan-100/60">
          The database answered — the `pages` collection is reachable, but
          nothing is published yet. Open the admin at{' '}
          <a href="http://localhost:3000/admin" className="text-cyan-300 underline underline-offset-4">
            /admin
          </a>{' '}
          and publish your first page.
        </Text>
      </View>
    );
  }
  return (
    <View className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => (
        <PageCard key={page.id} page={page} />
      ))}
    </View>
  );
}
