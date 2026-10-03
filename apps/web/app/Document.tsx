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
        <NextTopLoader color="var(--color-primary)" height={2} showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
