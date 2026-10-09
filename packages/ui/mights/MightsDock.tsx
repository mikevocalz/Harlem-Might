'use client';

import { useRef } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { BookOpen, CalendarClock, Ellipsis, Footprints, MapPinned } from 'lucide-react';
import { activeSection, primaryNav, secondaryNav } from './routes';

const ICONS = {
  Explore: MapPinned,
  Walks: Footprints,
  Stories: BookOpen,
  Today: CalendarClock,
} as const;

const item =
  'mights-focus relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 text-caption font-medium me:w-full me:flex-none me:py-2.5';

// Bar: a gold rule across the item's top. Rail: a gold rule down its leading
// edge, the same marker the native AppTabBar draws in rail mode.
const marker = 'absolute top-0 h-rail w-8 bg-primary me:bottom-2 me:left-0 me:top-2 me:h-auto me:w-rail';

// Mobile primary navigation (below md): a bottom dock on compact widths and a
// leading rail from Material medium (me, 600px) — the same composition
// MoyoLearn's ShellTabBar uses, so foldables and split windows get the rail +
// panes standard instead of the phone layout. "More" is a native <dialog>
// sheet: showModal() supplies the focus trap, inert backdrop and
// Escape-to-close, and close() returns focus to the More button.
export function MightsDock() {
  const pathname = usePathname() ?? '/';
  const current = activeSection(pathname);
  const sheet = useRef<HTMLDialogElement | null>(null);
  // No dock tab matches /about, /download or the legal pages, so More carries
  // the you-are-here state for the routes that live in its sheet.
  const inSheet = secondaryNav.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-rule-hairline bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden me:right-auto me:top-16 me:w-rail-width me:border-r me:border-t-0 me:pb-0"
      >
        <ul className="flex h-dock items-stretch px-1 me:h-full me:flex-col me:gap-1 me:px-0 me:py-4">
          {primaryNav.map((nav) => {
            const Icon = ICONS[nav.label];
            const active = current === nav.label;
            return (
              <li key={nav.label} className="flex flex-1 me:w-full me:flex-none">
                <Link
                  href={nav.href}
                  aria-current={active ? 'page' : undefined}
                  className={`${item} ${active ? 'text-primary' : 'text-text-muted'}`}
                >
                  {active ? <span aria-hidden className={marker} /> : null}
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {nav.label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1 me:w-full me:flex-none">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => sheet.current?.showModal()}
              className={`${item} ${inSheet ? 'text-primary' : 'text-text-muted'}`}
            >
              {inSheet ? <span aria-hidden className={marker} /> : null}
              <Ellipsis size={20} strokeWidth={inSheet ? 2.25 : 1.75} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={sheet}
        aria-labelledby="mights-more-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="mights-sheet m-0 mt-auto w-full max-w-none bg-paper p-0 text-text shadow-stoop backdrop:bg-mights-night/40 md:hidden"
      >
        <div className="flex items-center justify-between border-b border-rule-hairline px-5 py-4">
          <span id="mights-more-title" className="text-base font-semibold">
            More
          </span>
          <button
            type="button"
            onClick={() => sheet.current?.close()}
            className="mights-focus min-h-11 min-w-11 px-2 text-small font-medium text-primary"
          >
            Close
          </button>
        </div>
        <ul className="pb-[calc(env(safe-area-inset-bottom)+--spacing(3))]">
          {secondaryNav.map((link) => {
            const here = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.label}>
                <Link
                  href={link.href}
                  aria-current={here ? 'page' : undefined}
                  onClick={() => sheet.current?.close()}
                  className={`mights-focus flex min-h-12 items-center border-b border-rule-hairline px-5 text-base ${
                    here ? 'font-semibold text-primary' : ''
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </dialog>
    </>
  );
}
