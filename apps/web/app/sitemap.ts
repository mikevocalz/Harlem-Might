import type { MetadataRoute } from 'next';
import { HARLEM_PLACE_PREVIEWS } from '@acme/app/features/explore/explore.store.ts';
import { listExploreCatalogue } from '@acme/payload/server';
import { routes } from '@acme/ui/mights';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogue = await listExploreCatalogue();
  // No database (builds, dev without env): the fixture slugs still resolve.
  const placeSlugs =
    catalogue.status === 'ok' && catalogue.data.length
      ? catalogue.data.map((p) => p.slug)
      : HARLEM_PLACE_PREVIEWS.map((p) => p.id);
  const pages = [
    routes.home(),
    routes.explore(),
    routes.walks(),
    routes.stories(),
    routes.today(),
    routes.ar(),
    routes.download(),
    routes.about(),
    routes.press(),
    routes.legal('privacy'),
    routes.legal('terms'),
    routes.legal('accessibility'),
    ...placeSlugs.map((slug) => routes.place(slug)),
  ];
  return pages.map((path) => ({ url: base + path }));
}
