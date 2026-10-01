import NextTopLoader from 'nextjs-toploader';
import { display, sans } from './fonts';

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
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <NextTopLoader color="#00f3ff" height={3} showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
