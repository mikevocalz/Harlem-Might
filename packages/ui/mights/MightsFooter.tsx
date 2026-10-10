'use client';

import { Link } from 'solito/link';
import { Footer, Heading, Nav, Paragraph, Text } from '../html';
import { View } from '../tw';
import { MightsWordmark } from './MightsWordmark';
import { routes } from './routes';

const discover = [
  { label: 'Explore', href: routes.explore() },
  { label: 'Walks', href: routes.walks() },
  { label: 'Stories', href: routes.stories() },
  { label: 'Today', href: routes.today() },
  { label: 'AR concept', href: routes.ar() },
  { label: 'The app', href: routes.download() },
];
const company = [
  { label: 'About', href: routes.about() },
  { label: 'Press', href: routes.press() },
  { label: 'Accessibility', href: routes.legal('accessibility') },
  { label: 'Privacy', href: routes.legal('privacy') },
  { label: 'Terms', href: routes.legal('terms') },
];

// min-h-6 keeps every link at the 24px target floor (WCAG 2.5.8) without
// leaning on the spacing exception.
const link = 'mights-focus flex min-h-6 items-center text-ui text-text hover:text-primary';
// Kit text renders React Native Web text: `my-0 whitespace-normal font-sans`
// strips its browser heading margins, pre-wrap and system font stack.
const heading = 'my-0 whitespace-normal font-sans text-label font-semibold text-text-muted';

// Read once when the module loads (the build, for the static site), not per
// render: a render-time Date is an unstable value under Cache Components.
const YEAR = new Date().getFullYear();
const hydrationSafe = { suppressHydrationWarning: true } as object;

export function MightsFooter() {
  return (
    <Footer className="block border-t border-rule-hairline bg-surface pb-[calc(var(--spacing-dock)+env(safe-area-inset-bottom))] md:pb-0">
      <View className="mx-auto grid w-full max-w-screen-2xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-12 md:gap-6">
        <View className="flex flex-col gap-3 md:col-span-6">
          <MightsWordmark height={56} />
          <Paragraph className="my-0 max-w-xs whitespace-normal font-sans text-ui leading-6 text-text-muted">
            Built by the block, for the block.
          </Paragraph>
        </View>
        <Nav aria-label="Discover" className="flex flex-col gap-3 md:col-span-3">
          <Heading level={2} className={heading}>
            Discover
          </Heading>
          {discover.map((l) => (
            <Link key={l.label} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
        </Nav>
        <Nav aria-label="Company" className="flex flex-col gap-3 md:col-span-3">
          <Heading level={2} className={heading}>
            Company
          </Heading>
          {company.map((l) => (
            <Link key={l.label} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
        </Nav>
      </View>
      <View className="block border-t border-rule-hairline">
        <View className="mx-auto flex w-full flex-row max-w-screen-2xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-label text-text-muted sm:px-6">
          {/* Static pages render at build time, so this is the build year. A
              client hydrating after New Year may compute a later one. */}
          {/* RNW forwards suppressHydrationWarning to the DOM; RN's Text type lacks it. */}
          <Text {...hydrationSafe} className="text-inherit [font:inherit] whitespace-normal">
            © {YEAR} Harlem Might
          </Text>
        </View>
      </View>
    </Footer>
  );
}
