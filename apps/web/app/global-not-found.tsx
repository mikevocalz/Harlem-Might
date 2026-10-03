import type { Metadata } from 'next';
import { Document } from './Document';
import { SiteMotionShell } from '../components/site/SiteMotionShell';
import { NotFoundContent } from '../components/site/NotFoundContent';
import './rn-globals';
import './globals.css';

// Unmatched URLs bypass every layout (this app has two root layouts), so the
// document, fonts, theme and site shell are composed here.
export const metadata: Metadata = {
  title: 'Page not found — Harlem Might',
  description: 'There is no page at this address.',
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <Document>
      <SiteMotionShell>
        <NotFoundContent />
      </SiteMotionShell>
    </Document>
  );
}
