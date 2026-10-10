import type { PlaceRef } from '@acme/app/content';
import { getHarlemPlacePreview, type HarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { routes } from '@acme/ui/mights';

// /places/[slug] renders from the static catalogue (explore.store.ts), not
// from Payload. A Payload place whose slug is not in that catalogue has no
// page, so walks, stories and events link a place only when its page exists
// (nav never 404s). Shared by components/{walks,stories,today}.

export interface LinkedPlace {
  ref: PlaceRef;
  href: string;
  preview: HarlemPlacePreview;
}

export function linkPlace(ref: PlaceRef | undefined): LinkedPlace | null {
  if (!ref) return null;
  const preview = getHarlemPlacePreview(ref.slug);
  return preview ? { ref, href: routes.place(preview.id), preview } : null;
}

export const locatePlace = (slug: string) => getHarlemPlacePreview(slug)?.lngLat;
