import { Link, createFileRoute } from '@tanstack/react-router';
import { Card, Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Harlem Might Curator Workspace' },
      {
        name: 'description',
        content: 'Payload-backed catalogue and curator tools for Harlem Might.',
      },
    ],
  }),
  component: CuratorLanding,
});

function CuratorLanding() {
  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-screen-xl gap-8 px-4 py-16 sm:px-6 md:py-24">
        <View className="max-w-3xl gap-3">
          <Text className="text-sm font-semibold text-primary">Internal workspace</Text>
          <Heading level={1} size="display-md" className="text-text">
            Harlem Might catalogue + Payload tools
          </Heading>
          <Text className="text-base leading-7 text-text-muted">
            This Vite surface is for the canonical place catalogue, curation and
            Payload-backed operations. The public product experience lives in the
            Next.js web app.
          </Text>
        </View>

        <View className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/admin"
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
          >
            <Card className="min-h-48 gap-3 border-border bg-surface-raised p-6 shadow-card transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transform-none">
              <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Curator
              </Text>
              <Heading level={2} size="title" className="text-text">
                Open admin workspace
              </Heading>
              <Text className="text-sm leading-6 text-text-muted">
                Review catalogue health, source quality and curator-facing operations.
              </Text>
            </Card>
          </Link>

          <Link
            to="/admin/businesses"
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
          >
            <Card className="min-h-48 gap-3 border-border bg-surface-raised p-6 shadow-card transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transform-none">
              <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Catalogue
              </Text>
              <Heading level={2} size="title" className="text-text">
                Businesses + places
              </Heading>
              <Text className="text-sm leading-6 text-text-muted">
                Work with canonical records, lifecycle state, imagery and review data.
              </Text>
            </Card>
          </Link>
        </View>
      </Section>
    </Main>
  );
}
