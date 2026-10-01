'use client';
import { Link } from 'solito/link';
import { Footer, Nav, View, Text as TWText, P } from '@acme/ui/tw';
import { NAV_ITEMS, PROFILE } from './nav';

// The footer is a system map of the template, not decoration: every column
// states something true — the pages that exist, the tools that run, the
// stack underneath.
const TOOLKIT = [
  { label: 'Storybook', href: 'http://localhost:6006' },
  { label: 'Payload admin', href: '/admin' },
  { label: 'README', href: 'https://github.com/mikevocalz/Solito-NativeUI-Starter' },
] as const;

const STACK = ['Expo SDK 58', 'Next.js 16', 'Solito 5', 'Skia', 'Viro / OpenXR', 'Rive'] as const;

const footerLink =
  'text-sm text-cyan-100/60 transition-colors duration-fast hover:text-cyan-300 ' +
  'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50';

const columnTitle = 'text-xs font-semibold uppercase tracking-wider text-cyan-300';

export function SiteFooter() {
  return (
    <Footer className="border-t border-cyan-400/25 bg-[#050505] [box-shadow:0_-1px_24px_rgba(0,243,255,0.08)]">
      <View className="mx-auto w-full max-w-screen-2xl gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        {/* Brand */}
        <View className="max-w-xs gap-3">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-md border border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_14px_rgba(0,243,255,0.25)]">
              <TWText className="text-base font-bold text-cyan-300">H</TWText>
            </View>
            <TWText className="font-display text-lg font-bold uppercase tracking-widest text-cyan-50">
              Harlem Might
            </TWText>
          </View>
          <P className="text-sm leading-relaxed text-cyan-100/50">
            One codebase for screens, spatial windows and WebXR — Expo, Next.js,
            Skia, Rive and Viro on a single Neon Grid.
          </P>
        </View>

        {/* Columns */}
        <View className="flex-row flex-wrap gap-10 md:gap-16">
          <Nav aria-label="Pages" className="min-w-28 gap-2.5">
            <TWText className={columnTitle}>
              Pages
            </TWText>
            {[...NAV_ITEMS, PROFILE].map((item) => (
              <Link key={item.href} href={item.href} className={footerLink}>
                {item.label}
              </Link>
            ))}
          </Nav>

          <Nav aria-label="Toolkit" className="min-w-28 gap-2.5">
            <TWText className={columnTitle}>
              Toolkit
            </TWText>
            {TOOLKIT.map((item) => (
              <Link key={item.label} href={item.href} className={footerLink}>
                {item.label}
              </Link>
            ))}
          </Nav>

          <View className="min-w-28 gap-2.5">
            <TWText className={columnTitle}>
              Stack
            </TWText>
            {STACK.map((item) => (
              <TWText key={item} className="text-sm text-cyan-100/50">
                {item}
              </TWText>
            ))}
          </View>
        </View>
      </View>

      {/* Legal bar */}
      <View className="border-t border-cyan-400/15">
        <View className="mx-auto w-full max-w-screen-2xl flex-row flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
          <TWText className="text-xs text-cyan-100/40">© Harlem Might</TWText>
          <TWText className="text-xs text-cyan-100/40">MIT licensed — make it yours.</TWText>
        </View>
      </View>
    </Footer>
  );
}
