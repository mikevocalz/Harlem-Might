import { Link, createFileRoute } from '@tanstack/react-router';
import { Card, Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';

export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: 'Admin — Harlem Mights' }] }),
  component: AdminHome,
});

function AdminHome() {
  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-12 sm:px-6">
        <View className="max-w-3xl gap-3">
          <Text className="text-sm font-semibold text-primary">Curator workspace</Text>
          <Heading level={1} size="display-md" className="text-text">
            Harlem Mights admin
          </Heading>
          <Text className="text-base leading-7 text-text-muted">
            Review the canonical catalogue, freshness and source quality from the Vite workspace.
            Editing remains in Payload until the curator write API and role checks land.
          </Text>
        </View>

        <View className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link to="/admin/businesses" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40">
            <Card className="min-h-44 gap-3 border-border bg-surface-raised p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transform-none">
              <Text className="text-xs font-semibold text-primary">Catalogue</Text>
              <Heading level={2} size="title">Businesses and places</Heading>
              <Text className="text-sm leading-6 text-text-muted">
                Logos, fallback identity, category, area, lifecycle and field-level review state.
              </Text>
            </Card>
          </Link>
        </View>
      </Section>
    </Main>
  );
}
