import { Link } from '@tanstack/react-router';
import { Main, Section, Text } from '@acme/ui/tw';

export function NotFound() {
  return (
    <Main className="flex-1 items-center justify-center px-6 py-24">
      <Section className="max-w-md items-start gap-4">
        <Text className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
          404 / Off the grid
        </Text>
        <Text className="font-display text-3xl uppercase tracking-wide text-cyan-50">
          This sector is empty.
        </Text>
        <Text className="text-sm leading-relaxed text-cyan-100/60">
          The route exists in no manifest. Head back to the surface and pick a
          line that resolves.
        </Text>
        <Link
          to="/"
          className="mt-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition-colors duration-150 hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        >
          Return home
        </Link>
      </Section>
    </Main>
  );
}
