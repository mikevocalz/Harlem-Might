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
  'mights-focus relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium';

// Mobile primary navigation (< 768px). "More" is a native <dialog> sheet:
// showModal() supplies the focus trap, inert backdrop and Escape-to-close.
export function MightsDock() {
  const pathname = usePathname() ?? '/';
  const current = activeSection(pathname);
  const sheet = useRef<HTMLDialogElement | null>(null);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-rule-hairline bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-[12px] md:hidden"
      >
        <ul className="flex h-14 items-stretch px-1">
          {primaryNav.map((nav) => {
            const Icon = ICONS[nav.label];
            const active = current === nav.label;
            return (
              <li key={nav.label} className="flex flex-1">
                <Link
                  href={nav.href}
                  aria-current={active ? 'page' : undefined}
                  className={`${item} ${active ? 'text-primary' : 'text-text-muted'}`}
                >
                  {active ? <span aria-hidden className="absolute top-0 h-px w-8 bg-primary" /> : null}
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {nav.label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => sheet.current?.showModal()}
              className={`${item} text-text-muted`}
            >
              <Ellipsis size={20} strokeWidth={1.75} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={sheet}
        aria-label="More"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="mights-sheet m-0 mt-auto w-full max-w-none bg-paper p-0 text-text shadow-stoop backdrop:bg-mights-night/40 md:hidden"
      >
        <div className="flex items-center justify-between border-b border-rule-hairline px-5 py-4">
          <span className="text-base font-semibold">More</span>
          <button
            type="button"
            onClick={() => sheet.current?.close()}
            className="mights-focus min-h-11 px-2 text-sm font-medium text-primary"
          >
            Close
          </button>
        </div>
        <ul className="pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {secondaryNav.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                onClick={() => sheet.current?.close()}
                className="mights-focus flex min-h-12 items-center border-b border-rule-hairline px-5 text-base"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
