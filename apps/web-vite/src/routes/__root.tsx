import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { Document, DocumentBody, DocumentHead } from '@acme/ui/primitives';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import appCss from '../globals.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#EEF0EC' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', href: '/icon.png' },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <Document lang="en">
      <DocumentHead>
        <HeadContent />
      </DocumentHead>
      <DocumentBody className="flex min-h-screen flex-col bg-surface font-sans text-text">
        <SiteNav />
        {children}
        <SiteFooter />
        <Scripts />
      </DocumentBody>
    </Document>
  );
}
