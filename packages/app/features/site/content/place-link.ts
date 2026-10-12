import type { PlaceRef } from '@acme/app/content';
import { routes } from '@acme/ui/mights/routes';

// Populated relationships carry the canonical slug used by /places/[slug].
// Missing relationships remain unlinked; the Explore demo fixture is never
// an authority for whether a catalogue place has a page.

export interface LinkedPlace {
  ref: PlaceRef;
  href: string;
}

export function linkPlace(ref: PlaceRef | undefined): LinkedPlace | null {
  return ref ? { ref, href: routes.place(ref.slug) } : null;
}
