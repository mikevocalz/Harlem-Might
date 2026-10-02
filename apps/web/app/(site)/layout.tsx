import type { Metadata } from 'next';
import { Document } from '../Document';
import { SiteMotionShell } from '../../components/site/SiteMotionShell';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Harlem Might — see the block, know the story',
    template: '%s — Harlem Might',
  },
  description:
    'Discover Harlem through places, local context, entrance-aware routes and spatial stories that stay attached to the block where they belong.',
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Document>
      <SiteMotionShell>{children}</SiteMotionShell>
    </Document>
  );
}
