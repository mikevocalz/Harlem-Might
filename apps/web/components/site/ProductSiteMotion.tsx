'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import {
  attachScrollTrigger,
  ensureScrollTrigger,
} from 'kinetrell/web/gsap';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { createKinetrellLenis } from 'kinetrell/web/lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';

export function ProductSiteMotion({ children }: { children: React.ReactNode }) {
  const reducedMotion = useBrowserReducedMotion('system');

  useEffect(() => {
    if (!ensureScrollTrigger()) return;

    if (reducedMotion) {
      gsap.set('[data-motion-section], [data-site-header], [data-site-footer]', {
        clearProps: 'transform,opacity',
      });
      return;
    }

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

    const triggers: Array<ReturnType<typeof attachScrollTrigger>> = [];
    const context = gsap.context(() => {
      gsap.fromTo(
        '[data-site-header]',
        { yPercent: -100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.72, ease: 'power3.out' },
      );

      const sections = gsap.utils.toArray<HTMLElement>('[data-motion-section]');
      sections.forEach((section) => {
        const tween = gsap.fromTo(
          section,
          { y: 54, opacity: 0.001 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: 'power3.out',
            paused: true,
          },
        );

        triggers.push(
          attachScrollTrigger(tween, {
            trigger: section,
            start: 'top 84%',
            end: 'top 52%',
            scrub: 0.55,
          }),
        );
      });

      const footer = document.querySelector<HTMLElement>('[data-site-footer]');
      if (footer) {
        const tween = gsap.fromTo(
          footer,
          { y: 30, opacity: 0.72 },
          { y: 0, opacity: 1, duration: 1, ease: 'power2.out', paused: true },
        );
        triggers.push(
          attachScrollTrigger(tween, {
            trigger: footer,
            start: 'top 94%',
            end: 'top 76%',
            scrub: 0.45,
          }),
        );
      }

    });

    return () => {
      triggers.forEach((trigger) => trigger.kill());
      context.revert();
      disconnect();
      owned.destroy();
    };
  }, [reducedMotion]);

  return children;
}
