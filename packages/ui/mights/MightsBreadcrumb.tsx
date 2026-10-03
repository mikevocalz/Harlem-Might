'use client';

import { Link } from 'solito/link';

export interface Crumb {
  label: string;
  href?: string;
}

// WAI-ARIA breadcrumb + schema.org BreadcrumbList. Separators are hairline
// ticks, not slashes or chevrons.
export function MightsBreadcrumb({ items, origin = '' }: { items: Crumb[]; origin?: string }) {
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
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-screen-2xl px-4 pt-4 sm:px-6">
      <ol className="flex flex-wrap items-center gap-3 text-[13px] text-text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-3">
              {i > 0 ? <span aria-hidden className="h-3 w-px bg-rule-hairline" /> : null}
              {last || !item.href ? (
                <span aria-current={last ? 'page' : undefined} className={last ? 'text-text' : ''}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="mights-focus hover:text-primary">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}
