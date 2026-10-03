'use client';

import { useEffect } from 'react';
import { Link } from 'solito/link';
import { usePathname } from 'solito/navigation';
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

  return (
    <header
      className={`sticky top-0 z-50 h-16 transition-[background-color,border-color] duration-[120ms] ${
        frosted
          ? 'border-b border-rule-hairline bg-paper/80 backdrop-blur-[12px]'
          : 'border-b border-transparent bg-transparent'
      } ${ink}`}
    >
      <div className="mx-auto flex h-full w-full max-w-screen-2xl items-center gap-4 px-4 sm:px-6">
        <MightsWordmark />
        <nav aria-label="Main" className="ml-auto hidden md:block lg:ml-16 lg:mr-auto">
          <ul className="flex items-center gap-1">
            {primaryNav.map((item) => {
              const active = current === item.label;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`mights-focus group relative flex h-16 items-center px-3.5 text-[14px] font-medium tracking-[0.02em] ${expanded}`}
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={`absolute bottom-4 left-3.5 right-3.5 h-[2px] origin-left bg-primary transition-transform duration-[120ms] ${
                        active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto hidden items-center gap-3 md:flex lg:ml-0">
          <MightsButton href={routes.ar()} variant="secondary" size="sm">
            Preview AR
          </MightsButton>
          <MightsButton href={routes.download()} size="sm">
            Get the app
          </MightsButton>
        </div>
      </div>
    </header>
  );
}
