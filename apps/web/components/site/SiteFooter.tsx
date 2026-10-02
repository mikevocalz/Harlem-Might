'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from 'solito/link';
import { attachScrollTrigger, ensureScrollTrigger } from 'kinetrell/web/gsap';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { Footer, Nav, View, Text as TWText, P } from '@acme/ui/tw';
import { NAV_ITEMS, PROFILE } from './nav';

const footerLink =
  'rounded text-sm text-text-muted transition-colors duration-200 hover:text-primary ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40';

const columnTitle = 'text-xs font-semibold uppercase tracking-[0.16em] text-primary';

export function SiteFooter() {
  const rootRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useBrowserReducedMotion('system');

  useEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content || reducedMotion || !ensureScrollTrigger()) return;

    const timeline = gsap.timeline({ paused: true });
    timeline.fromTo(
      content,
      { y: 34, autoAlpha: 0.55 },
      { y: 0, autoAlpha: 1, ease: 'none', duration: 1 },
    );

    const trigger = attachScrollTrigger(timeline, {
      trigger: root,
      start: 'top 92%',
      end: 'top 62%',
      scrub: 0.55,
    });

    return () => {
      trigger.kill();
      timeline.kill();
    };
  }, [reducedMotion]);

  return (
    <Footer
      ref={rootRef as never}
      className="border-t border-border bg-surface-raised"
    >
      <View
        ref={contentRef as never}
        className="mx-auto w-full max-w-screen-2xl gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:justify-between"
      >
        <View className="max-w-md gap-3">
          <TWText className="font-display text-xl font-bold tracking-[-0.03em] text-text">
            Harlem Might
          </TWText>
          <P className="text-sm leading-6 text-text-muted">
            Discover Harlem through places, stories, routes and spatial layers that
            keep context attached to the block where it belongs.
          </P>
          <TWText className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            See the block. Know the story.
          </TWText>
        </View>

        <View className="flex-row flex-wrap gap-10 md:gap-16">
          <Nav aria-label="Product" className="min-w-28 gap-2.5">
            <TWText className={columnTitle}>Product</TWText>
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={footerLink}>
                {item.label}
              </Link>
            ))}
          </Nav>

          <Nav aria-label="Account" className="min-w-28 gap-2.5">
            <TWText className={columnTitle}>Account</TWText>
            <Link href={PROFILE.href} className={footerLink}>
              Profile
            </Link>
            <Link href="/settings" className={footerLink}>
              Settings
            </Link>
          </Nav>

          <View className="max-w-52 gap-2.5">
            <TWText className={columnTitle}>Built for place</TWText>
            <TWText className="text-sm leading-6 text-text-muted">
              First-party catalogue, entrance-aware routes, verified sources and
              spatial storytelling.
            </TWText>
          </View>
        </View>
      </View>

      <View className="border-t border-border">
        <View className="mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <TWText className="text-xs text-text-muted">© Harlem Might</TWText>
          <TWText className="text-xs text-text-muted">Built for Harlem first.</TWText>
        </View>
      </View>
    </Footer>
  );
}
