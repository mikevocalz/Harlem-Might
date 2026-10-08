'use client';

import { Link } from 'solito/link';
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
const heading = 'text-label font-semibold text-text-muted';

// Read once when the module loads (the build, for the static site), not per
// render: a render-time Date is an unstable value under Cache Components.
const YEAR = new Date().getFullYear();

export function MightsFooter() {
  return (
    <footer className="border-t border-rule-hairline bg-surface pb-[calc(var(--spacing-dock)+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto grid w-full max-w-screen-2xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-12 md:gap-6">
        <div className="flex flex-col gap-3 md:col-span-6">
          <MightsWordmark height={56} />
          <p className="max-w-xs text-ui leading-6 text-text-muted">Built by the block, for the block.</p>
        </div>
        <nav aria-label="Discover" className="flex flex-col gap-3 md:col-span-3">
          <h2 className={heading}>Discover</h2>
          {discover.map((l) => (
            <Link key={l.label} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Company" className="flex flex-col gap-3 md:col-span-3">
          <h2 className={heading}>Company</h2>
          {company.map((l) => (
            <Link key={l.label} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-rule-hairline">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-label text-text-muted sm:px-6">
          {/* Static pages render at build time, so this is the build year. A
              client hydrating after New Year may compute a later one. */}
          <span suppressHydrationWarning>© {YEAR} Harlem Might</span>
        </div>
      </div>
    </footer>
  );
}
