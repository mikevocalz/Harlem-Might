'use client';

import { Link } from 'solito/link';
import { Footer, Nav, View, Text as TWText, P } from '@acme/ui/tw';
import { NAV_ITEMS, PROFILE } from './nav';

const footerLink =
  'rounded text-sm text-cyan-100/55 transition-colors duration-fast hover:text-cyan-300 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50';

const columnTitle = 'text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300';

export function SiteFooter() {
  return (
    <Footer
      data-site-footer
      className="border-t border-cyan-400/20 bg-[#050505] [box-shadow:0_-1px_28px_rgba(0,243,255,0.06)]"
    >
      <View className="mx-auto w-full max-w-screen-2xl gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between md:py-16">
        <View className="max-w-md gap-4">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-md border border-cyan-400/45 bg-cyan-400/10 shadow-[0_0_14px_rgba(0,243,255,0.2)]">
              <TWText className="text-base font-bold text-cyan-300">H</TWText>
            </View>
            <TWText className="font-display text-lg font-bold uppercase tracking-widest text-cyan-50">
              Harlem Might
            </TWText>
          </View>

          <P className="max-w-sm text-sm leading-6 text-cyan-100/50">
            A living spatial guide to Harlem — places, food, culture, stories,
            routes and neighborhood context connected in one experience.
          </P>

          <TWText className="text-xs leading-5 text-cyan-100/35">
            Harlem first. Sources, place identity and corrections stay attached to the
            experience as it moves from screen to spatial view.
          </TWText>
        </View>

        <View className="flex-row flex-wrap gap-10 md:gap-16">
          <Nav aria-label="Explore Harlem Might" className="min-w-28 gap-2.5">
            <TWText className={columnTitle}>Explore</TWText>
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
            <Link href="/notifications" className={footerLink}>
              Notifications
            </Link>
          </Nav>

          <View className="min-w-40 gap-2.5">
            <TWText className={columnTitle}>Built for the block</TWText>
            <TWText className="text-sm text-cyan-100/50">Place-first discovery</TWText>
            <TWText className="text-sm text-cyan-100/50">Context-aware routes</TWText>
            <TWText className="text-sm text-cyan-100/50">Spatial + AR layers</TWText>
            <TWText className="text-sm text-cyan-100/50">Saved local knowledge</TWText>
          </View>
        </View>
      </View>

      <View className="border-t border-cyan-400/10">
        <View className="mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <TWText className="text-xs text-cyan-100/35">© Harlem Might</TWText>
          <TWText className="text-xs text-cyan-100/35">
            Harlem in context, not just on a map.
          </TWText>
        </View>
      </View>
    </Footer>
  );
}
