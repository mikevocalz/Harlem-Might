import { Link } from '@tanstack/react-router';
import { Main, Section, Text } from '@acme/ui/tw';

export function NotFound() {
  return (
    <Main className="flex-1 items-center justify-center bg-surface px-6 py-24">
      <Section className="max-w-md items-start gap-4">
        <Text className="text-sm font-semibold text-primary">404</Text>
        <Text className="font-display text-3xl font-semibold tracking-[-0.03em] text-text">
          This route is not on the map.
        </Text>
        <Text className="text-sm leading-6 text-text-muted">
          Head back to Harlem Mights and choose another place, story or walk.
        </Text>
        <Link
          to="/"
          className="mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
        >
          Return home
        </Link>
      </Section>
    </Main>
  );
}
