'use client';

import { Link } from 'solito/link';
import { MightsWordmark } from './MightsWordmark';
import { routes } from './routes';

const discover = [
  { label: 'Explore', href: routes.explore() },
  { label: 'Walks', href: routes.walks() },
  { label: 'Stories', href: routes.stories() },
  { label: 'Today', href: routes.today() },
  { label: 'Preview AR', href: routes.ar() },
];
const company = [
  { label: 'About', href: routes.about() },
  { label: 'Press', href: routes.press() },
  { label: 'Accessibility', href: routes.legal('accessibility') },
  { label: 'Privacy', href: routes.legal('privacy') },
  { label: 'Terms', href: routes.legal('terms') },
];

const link = 'mights-focus text-[15px] text-text hover:text-primary';
const heading = 'text-[13px] font-semibold text-text-muted';

export function MightsFooter() {
  return (
    <footer className="border-t border-rule-hairline bg-surface pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto grid w-full max-w-screen-2xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-12 md:gap-6">
        <div className="flex flex-col gap-3 md:col-span-5">
          <MightsWordmark height={56} />
          <p className="max-w-xs text-[15px] leading-6 text-text-muted">Built from local knowledge.</p>
        </div>
        <nav aria-label="Discover" className="flex flex-col gap-3 md:col-span-2">
          <h2 className={heading}>Discover</h2>
          {discover.map((l) => (
            <Link key={l.label} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Company" className="flex flex-col gap-3 md:col-span-2">
          <h2 className={heading}>Company</h2>
          {company.map((l) => (
            <Link key={l.label} href={l.href} className={link}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3 md:col-span-3">
          <h2 className={heading}>Get the app</h2>
          {/* ponytail: official App Store / Google Play badge artwork and the
              per-page QR land with the store listings; until then both point
              at the download page. */}
          <Link href={routes.download()} className={link}>
            iPhone and Android
          </Link>
        </div>
      </div>
      <div className="border-t border-rule-hairline">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-[13px] text-text-muted sm:px-6">
          <span>© 2026 Harlem Might</span>
          <span>Photographs credited on each page</span>
        </div>
      </div>
    </footer>
  );
}
