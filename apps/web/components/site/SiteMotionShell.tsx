'use client';

import { Suspense, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'solito/navigation';
import { Link } from '@acme/ui/html';
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

function SiteMotion() {
  const pathname = usePathname() ?? '/';
  const reducedMotion = useSyncExternalStore(subscribeReduced, readReduced, serverReduced);
  // Explore is a full-viewport map workspace: smooth scroll would fight its canvas.
  const workspace = pathname.startsWith(routes.explore());

  useEffect(() => {
    const main = document.getElementById('main');
    main?.setAttribute('data-product-route', pathname);
    return () => main?.removeAttribute('data-product-route');
  }, [pathname]);

  // Lenis eases toward its own target and writes it to the window every
  // frame, so after a route change it pulled the new page back toward the old
  // page's offset and it opened partway down. Stop it in the commit (layout
  // effect, before its next frame can write), send a link navigation to the
  // top, leave back/forward to the browser's own restoration, and restart it a
  // few frames later. Lenis's start() resets to the window's real offset.
  const lenisRef = useRef<{ stop(): void; start(): void } | null>(null);
  const popped = useRef(false);
  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useLayoutEffect(() => {
    const restoring = popped.current;
    popped.current = false;
    const lenis = lenisRef.current;
    lenis?.stop();
    if (!restoring) window.scrollTo(0, 0);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => lenis?.start());
    });
    return () => {
      cancelAnimationFrame(frame);
      lenis?.start();
    };
  }, [pathname]);

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
        lenisRef.current = owned.lenis;
        teardown = () => {
          lenisRef.current = null;
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

  return null;
}

function SiteNavbar() {
  const pathname = usePathname() ?? '/';
  return <MightsNavbar overlay={pathname === routes.home()} />;
}

function SiteFooter() {
  const pathname = usePathname() ?? '/';
  return pathname.startsWith(routes.explore()) ? null : <MightsFooter />;
}

export function SiteMotionShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Link href="#main" className="skip-link">
        Skip to content
      </Link>
      <Suspense>
        <SiteMotion />
      </Suspense>
      <Suspense>
        <SiteNavbar />
      </Suspense>
      <View id="main" className="min-h-[calc(100dvh-4rem)] flex-1 me:pl-rail-width md:pl-0">
        {children}
      </View>
      <Suspense>
        <SiteFooter />
      </Suspense>
      <Suspense>
        <MightsDock />
      </Suspense>
    </>
  );
}
