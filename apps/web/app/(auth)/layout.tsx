import type { Metadata } from 'next';
import { Document } from '../Document';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Harlem Might — see the block, know the story',
    template: '%s — Harlem Might',
  },
  description: 'Places, walks and the history attached to each corner of Harlem, on one map.',
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Document>{children}</Document>;
}
