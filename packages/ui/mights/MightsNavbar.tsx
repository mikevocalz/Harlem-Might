'use client';

import { useEffect } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
import { Header, List, ListItem, Nav } from '../html';
import { View } from '../tw';
import { MightsButton } from './MightsButton';
import { MightsWordmark } from './MightsWordmark';
import { activeSection, primaryNav, routes } from './routes';
import { useShell } from './store';
import { expanded } from './geometry';

export interface MightsNavbarProps {
  /** Transparent while a page-top photograph or hero sits under the bar. */
  overlay?: boolean;
  /** Ink over the overlay — decided per hero, never auto-detected. */
  tone?: 'iron' | 'paper';
}

export function MightsNavbar({ overlay = false, tone = 'iron' }: MightsNavbarProps) {
  const pathname = usePathname() ?? '/';
  const scrolled = useShell((s) => s.scrolled);
  const current = activeSection(pathname);

  useEffect(() => {
    const onScroll = () => useShell.getState().setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const frosted = !overlay || scrolled;
  const ink = !frosted && tone === 'paper' ? 'text-white' : 'text-text';

  // Over a hero the bar is a scrim, not glass: warm black (the page surface,
  // so the dark half of a hero shows no band) fading to clear, so the
  // links stay readable where the hero runs a photograph or map under them.
  // bg-origin-border: otherwise the gradient tile repeats into the 1px
  // transparent border and draws a dark line along the bottom edge.
  return (
    <Header
      className={`sticky top-0 z-50 block h-16 transition-[background-color,border-color] duration-fast ${
        frosted
          ? 'border-b border-rule-hairline bg-paper/80 backdrop-blur-md'
          : 'border-b border-transparent bg-linear-to-b bg-origin-border from-mights-warm-black/90 via-mights-warm-black/60 to-transparent'
      } ${ink}`}
    >
      <View className="mx-auto flex h-full w-full flex-row max-w-screen-2xl items-center gap-4 px-4 sm:px-6">
        <MightsWordmark />
        <Nav aria-label="Main" className="ml-auto hidden md:block lg:ml-16 lg:mr-auto">
          <List className="flex flex-row items-center gap-1">
            {primaryNav.map((item) => {
              const active = current === item.label;
              return (
                <ListItem key={item.label} className="block">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`mights-focus group relative flex h-16 items-center px-3.5 text-small font-medium tracking-[0.02em] ${expanded}`}
                  >
                    {item.label}
                    <View
                      aria-hidden
                      className={`absolute bottom-4 left-3.5 right-3.5 h-rail origin-left bg-primary transition-transform duration-fast ${
                        active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </Link>
                </ListItem>
              );
            })}
          </List>
        </Nav>
        {/* One button. Member auth is optional but has to be discoverable;
            the sign-in page links to account creation, so "Join" would be a
            second door to the same place. The app and AR links stay in the
            dock's More sheet and footer. */}
        <View className="ml-auto hidden flex-row items-center md:flex lg:ml-0">
          <MightsButton
            href={routes.signIn()}
            variant="outline"
            size="sm"
            aria-current={pathname === routes.signIn() ? 'page' : undefined}
          >
            Sign in
          </MightsButton>
        </View>
      </View>
    </Header>
  );
}
