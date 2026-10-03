import NextTopLoader from 'nextjs-toploader';
import { mona, newsreader } from './fonts';

const THEME_SCRIPT =
  "try{var m=document.cookie.match(/(?:^|; )app-theme=(light|dark)/);" +
  "if(m)document.documentElement.setAttribute('data-theme',m[1]);}catch(e){}";

type Props = {
  children: React.ReactNode;
};

export function Document({ children }: Props) {
  // suppressHydrationWarning: THEME_SCRIPT sets data-theme from the cookie
  // before hydration — an intentional server/client attribute difference.
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${mona.variable} ${newsreader.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <NextTopLoader color="var(--color-primary)" height={2} showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
