import type { MetadataRoute } from 'next';
import { HARLEM_PLACE_PREVIEWS } from '@acme/app/features/explore/explore.store.ts';
import { routes } from '@acme/ui/mights';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
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
    ...HARLEM_PLACE_PREVIEWS.map((p) => routes.place(p.id)),
  ];
  return pages.map((path) => ({ url: base + path }));
}
