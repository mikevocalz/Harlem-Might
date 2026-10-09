'use client';

import { useState } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { BookOpen, CalendarClock, Ellipsis, Footprints, MapPinned } from 'lucide-react';
import { Button, List, ListItem, Nav } from '../html';
import { View } from '../tw';
import { BottomSheet } from '../BottomSheet';
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
// panes standard instead of the phone layout. "More" opens the kit
// BottomSheet (vaul on web, native sheets in the app): drag, backdrop and
// Escape dismiss it.
export function MightsDock() {
  const pathname = usePathname() ?? '/';
  const current = activeSection(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  // No dock tab matches /about, /download or the legal pages, so More carries
  // the you-are-here state for the routes that live in its sheet.
  const inSheet = secondaryNav.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));

  return (
    <>
      <Nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-rule-hairline bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden me:right-auto me:top-16 me:w-rail-width me:border-r me:border-t-0 me:pb-0"
      >
        <List className="flex h-dock flex-row items-stretch px-1 me:h-full me:flex-col me:gap-1 me:px-0 me:py-4">
          {primaryNav.map((nav) => {
            const Icon = ICONS[nav.label];
            const active = current === nav.label;
            return (
              <ListItem key={nav.label} className="flex flex-1 flex-row me:w-full me:flex-none">
                <Link
                  href={nav.href}
                  aria-current={active ? 'page' : undefined}
                  className={`${item} ${active ? 'text-primary' : 'text-text-muted'}`}
                >
                  {active ? <View aria-hidden className={marker} /> : null}
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {nav.label}
                </Link>
              </ListItem>
            );
          })}
          <ListItem className="flex flex-1 flex-row me:w-full me:flex-none">
            <Button
              aria-haspopup="dialog"
              onPress={() => setMoreOpen(true)}
              className={`${item} ${inSheet ? 'text-primary' : 'text-text-muted'}`}
            >
              {inSheet ? <View aria-hidden className={marker} /> : null}
              <Ellipsis size={20} strokeWidth={inSheet ? 2.25 : 1.75} aria-hidden />
              More
            </Button>
          </ListItem>
        </List>
      </Nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <List className="block pb-[calc(env(safe-area-inset-bottom)+--spacing(3))]">
          {secondaryNav.map((link) => {
            const here = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <ListItem key={link.label} className="block">
                <Link
                  href={link.href}
                  aria-current={here ? 'page' : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={`mights-focus flex min-h-12 items-center border-b border-rule-hairline px-1 text-base ${
                    here ? 'font-semibold text-primary' : 'text-text'
                  }`}
                >
                  {link.label}
                </Link>
              </ListItem>
            );
          })}
        </List>
      </BottomSheet>
    </>
  );
}
