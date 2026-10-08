'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'solito/navigation';
import { View } from '@acme/ui/tw';
import { MightsDock, MightsFooter, MightsNavbar, routes } from '@acme/ui/mights';

/**
 * Product-site shell and motion owner.
 *
 * Kinetrell owns Lenis and the GSAP clock for the entire public Next.js site.
 * Screens attach their one orchestrated moment to that clock; the shell itself
 * adds no route-entrance animation.
 *
 * Lenis and the GSAP bridge are imported inside the effect, so routes that
 * never smooth-scroll (Explore, and every route under reduced motion) don't
 * download them. Content never waits on that import: nothing is pre-hidden
 * until motion.ts arms the page, and with JS off the shell is static.
 */
// Same reading as kinetrell's useBrowserReducedMotion('system'), without its
// module: kinetrell/web/react imports gsap at the top level, which put GSAP in
// every route's initial JS, Explore included.
const REDUCE = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (onChange: () => void) => {
  const media = window.matchMedia(REDUCE);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};
const readReduced = () => window.matchMedia(REDUCE).matches;
const serverReduced = () => false;

export function SiteMotionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const reducedMotion = useSyncExternalStore(subscribeReduced, readReduced, serverReduced);
  // Explore is a full-viewport map workspace: no footer under it.
  const workspace = pathname.startsWith(routes.explore());

  useEffect(() => {
    if (reducedMotion || workspace) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;
    void Promise.all([import('kinetrell/web/lenis'), import('kinetrell/web/gsap-lenis')]).then(
      ([{ createKinetrellLenis }, { connectGsapLenis }]) => {
        if (cancelled) return;
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
        teardown = () => {
          disconnect();
          owned.destroy();
        };
      },
    );

    return () => {
      cancelled = true;
      teardown?.();
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
