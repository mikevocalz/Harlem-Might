/**
 * The site's top bar — dark glass with a cyan hairline, matching the app
 * chrome (apps/web/components/site/SiteHeader.tsx).
 *
 * SOT-KEYWORDS: web-vite site nav header dark cyan glass
 */
import { Link } from '@tanstack/react-router';
import { Header, Nav, Text, View } from '@acme/ui/tw';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:3000';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/pages', label: 'Content' },
] as const;

export function SiteNav() {
  return (
    <Header className="sticky top-0 z-50 border-b border-cyan-400/15 bg-[#050505]/75 backdrop-blur-md">
      <View className="mx-auto w-full max-w-screen-2xl flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          aria-label="Harlem Might home"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        >
          <View className="h-9 w-9 items-center justify-center rounded-md border border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_14px_rgba(0,243,255,0.25)]">
            <Text className="text-base font-bold text-cyan-300">H</Text>
          </View>
          <Text className="font-display text-lg font-bold uppercase tracking-widest text-cyan-50">
            Harlem Might
          </Text>
        </Link>

        <Nav aria-label="Primary" className="flex-row items-center gap-1">
          {LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === '/' }}
              className="rounded-md px-3.5 py-2 text-sm font-medium tracking-wide text-cyan-100/60 transition-colors duration-150 hover:bg-cyan-400/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              activeProps={{
                className:
                  'rounded-md px-3.5 py-2 text-sm font-semibold tracking-wide bg-cyan-400/10 text-cyan-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50',
              }}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={`${APP_URL}/admin`}
            className="ml-2 rounded-md border border-cyan-400/30 px-3.5 py-2 text-sm font-medium tracking-wide text-cyan-300 transition-colors duration-150 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
          >
            CMS
          </a>
        </Nav>
      </View>
    </Header>
  );
}
