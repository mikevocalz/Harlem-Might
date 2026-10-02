'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { usePathname } from 'solito/navigation';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { createKinetrellLenis } from 'kinetrell/web/lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { View } from '@acme/ui/tw';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

/**
 * Product-site motion owner.
 *
 * Kinetrell owns Lenis and the GSAP clock for the entire public Next.js site.
 * Individual screens can attach GSAP/ScrollTrigger timelines without creating
 * a second smooth-scroll instance.
 */
export function SiteMotionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const routeRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useBrowserReducedMotion('system');

  useEffect(() => {
    if (reducedMotion) return;

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
  }, [reducedMotion]);

  useEffect(() => {
    const route = routeRef.current;
    if (!route || reducedMotion) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        route,
        { autoAlpha: 0.72, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility',
        },
      );
    }, route);

    return () => context.revert();
  }, [pathname, reducedMotion]);

  return (
    <>
      <SiteHeader />
      <View
        ref={routeRef as never}
        className="min-h-screen flex-1"
        data-product-route={pathname}
      >
        {children}
      </View>
      <SiteFooter />
    </>
  );
}
