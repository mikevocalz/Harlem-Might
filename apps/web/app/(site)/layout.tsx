import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { Document } from '../Document';
import { SiteHeader } from '../../components/site/SiteHeader';
import { SiteFooter } from '../../components/site/SiteFooter';
import { ProductSiteMotion } from '../../components/site/ProductSiteMotion';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Harlem Might',
    template: '%s — Harlem Might',
  },
  description:
    'Explore Harlem through places, stories, culture, routes and spatial context — all connected to the neighborhood.',
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Document>
      <ProductSiteMotion>
        <SiteHeader />
        <View className="min-h-screen flex-1 bg-[#050505]">{children}</View>
        <SiteFooter />
      </ProductSiteMotion>
    </Document>
  );
}
