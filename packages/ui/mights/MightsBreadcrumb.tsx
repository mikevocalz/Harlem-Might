'use client';

import { Link } from 'solito/link';
import { ListItem, Nav, OrderedList, Text } from '../html';
import { View } from '../tw';
import { JsonLd } from './MightsJsonLd';

export interface Crumb {
  label: string;
  href?: string;
}

// WAI-ARIA breadcrumb + schema.org BreadcrumbList. Separators are hairline
// ticks, not slashes or chevrons.
// Google requires absolute item URLs in BreadcrumbList.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export function MightsBreadcrumb({ items, origin = SITE }: { items: Crumb[]; origin?: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: origin + item.href } : {}),
    })),
  };
  return (
    <Nav aria-label="Breadcrumb" className="mx-auto block w-full max-w-screen-2xl px-4 pt-4 sm:px-6">
      <OrderedList className="flex flex-wrap items-center gap-3 text-label text-text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <ListItem key={item.label} className="flex flex-row items-center gap-3">
              {i > 0 ? <View aria-hidden className="h-3 w-px bg-rule-hairline" /> : null}
              {last || !item.href ? (
                <Text
                  aria-current={last ? 'page' : undefined}
                  className={`[font:inherit] whitespace-normal ${last ? 'text-text' : 'text-inherit'}`}
                >
                  {item.label}
                </Text>
              ) : (
                <Link href={item.href} className="mights-focus hover:text-primary">
                  {item.label}
                </Link>
              )}
            </ListItem>
          );
        })}
      </OrderedList>
      <JsonLd data={jsonLd} />
    </Nav>
  );
}
