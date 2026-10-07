import NextTopLoader from 'nextjs-toploader';
import { mona, newsreader } from './fonts';

type Props = {
  children: React.ReactNode;
};

export function Document({ children }: Props) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${mona.variable} ${newsreader.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans">
        {/* Mapbox static tiles are the site imagery — warm the connection
            before the hero <img> needs it (hoisted to <head> by React). */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
        <NextTopLoader color="var(--color-primary)" height={2} showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
