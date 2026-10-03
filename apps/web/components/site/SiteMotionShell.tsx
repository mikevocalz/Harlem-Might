'use client';

import { useEffect } from 'react';
import { usePathname } from 'solito/navigation';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { createKinetrellLenis } from 'kinetrell/web/lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { View } from '@acme/ui/tw';
import { MightsDock, MightsFooter, MightsNavbar, routes } from '@acme/ui/mights';

/**
 * Product-site shell and motion owner.
 *
 * Kinetrell owns Lenis and the GSAP clock for the entire public Next.js site.
 * Screens attach their one orchestrated moment to that clock; the shell itself
 * adds no route-entrance animation.
 */
export function SiteMotionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const reducedMotion = useBrowserReducedMotion('system');
  // Explore is a full-viewport map workspace: no footer under it.
  const workspace = pathname.startsWith(routes.explore());

  useEffect(() => {
    if (reducedMotion || workspace) return;

    const owned = createKinetrellLenis({
      autoRaf: false,
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.92,
    });
    const disconnect = connectGsapLenis(owned.lenis, {
      clock: 'kinetrell',
      refreshOnConnect: true,
    });

    return () => {
      disconnect();
      owned.destroy();
    };
  }, [reducedMotion, workspace]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <MightsNavbar overlay={pathname === routes.home()} />
      <View id="main" className="min-h-[calc(100dvh-4rem)] flex-1" data-product-route={pathname}>
        {children}
      </View>
      {workspace ? null : <MightsFooter />}
      <MightsDock />
    </>
  );
}
