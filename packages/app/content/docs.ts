// The document shapes the readers consume, written as the minimum structure
// they need. packages/app must not import Payload or @acme/payload
// (packages/config/eslint/boundaries.mjs: FORBID_BACKEND_DIRECT), so these are
// declared here. The binding in packages/payload/server.ts passes the
// generated `Walk`/`Story`/`Event` documents into these types, so tsc fails
// there if the CMS schema drifts away from this contract.

import type { EditorialImageRole, EditorialImageSource } from '@acme/assets';

type Nullable<T> = T | null | undefined;

export interface PlaceDoc {
  id: number;
  slug: string;
  /** Old generated paths kept only for redirects. */
  legacySlugs?: Nullable<{ slug: string }[]>;
  name: string;
  kind: 'business' | 'culture' | 'historic' | 'outdoors' | 'public-art' | 'community';
  lifecycle: 'open' | 'temporarily_closed' | 'seasonal' | 'permanently_closed' | 'historical_only' | 'unknown';
  primaryCategory?: Nullable<string>;
  primaryArea?: Nullable<string>;
  summary?: Nullable<string>;
  location?: Nullable<readonly [number, number]>;
  locationAccuracy: 'verified' | 'approx' | 'pending';
  locationSource?: Nullable<{ url?: Nullable<string>; verifiedAt?: Nullable<string> }>;
  address?: Nullable<{
    formatted?: Nullable<string>;
    neighborhood?: Nullable<string>;
    postalCode?: Nullable<string>;
  }>;
  website?: Nullable<string>;
  phone?: Nullable<string>;
  openingHours?: Nullable<{
    osm?: Nullable<string>;
    note?: Nullable<string>;
    sourceUrl?: Nullable<string>;
    verifiedAt?: Nullable<string>;
  }>;
  menus?: Nullable<
    {
      label: string;
      format: 'image_gallery' | 'pdf' | 'web';
      mealPeriod?: Nullable<string>;
      url?: Nullable<string>;
      sourceUrl?: Nullable<string>;
      lastVerifiedAt?: Nullable<string>;
      active?: Nullable<boolean>;
    }[]
  >;
  featured?: Nullable<boolean>;
  images?: Nullable<(number | MediaDoc)[]>;
}

export interface MediaDoc {
  id?: number;
  alt: string;
  url?: Nullable<string>;
  width?: Nullable<number>;
  height?: Nullable<number>;
  role?: Nullable<EditorialImageRole>;
  source?: Nullable<EditorialImageSource>;
  sourceUrl?: Nullable<string>;
  license?: Nullable<string>;
  licenseUrl?: Nullable<string>;
  creator?: Nullable<string>;
  credit?: Nullable<string>;
  attributionText?: Nullable<string>;
  capturedAt?: Nullable<string>;
  ingestedAt?: Nullable<string>;
  placeholderHash?: Nullable<string>;
  dominantColor?: Nullable<string>;
  shareAlike?: Nullable<boolean>;
  noDerivatives?: Nullable<boolean>;
}

export interface SourceDoc {
  label: string;
  url?: Nullable<string>;
  accessedAt?: Nullable<string>;
}

export interface WalkDoc {
  id: number;
  slug: string;
  title: string;
  summary: string;
  stops: { place: number | PlaceDoc; note?: Nullable<string> }[];
  distanceMeters: number;
  durationMinutes: number;
  startDescription: string;
  endDescription: string;
  accessibility?: { note?: Nullable<string>; sourceUrl?: Nullable<string>; verifiedAt?: Nullable<string> };
  images?: Nullable<(number | MediaDoc)[]>;
  sources?: Nullable<SourceDoc[]>;
  updatedAt: string;
}

export interface StoryDoc {
  id: number;
  slug: string;
  title: string;
  dek?: Nullable<string>;
  body: string;
  author: string;
  places?: Nullable<(number | PlaceDoc)[]>;
  images?: Nullable<(number | MediaDoc)[]>;
  archive?: Nullable<
    {
      media: number | MediaDoc;
      caption?: Nullable<string>;
      credit: string;
      rights: 'owned' | 'licensed' | 'venue_supplied' | 'open_license' | 'public_domain';
      rightsHolder?: Nullable<string>;
      license?: Nullable<string>;
      sourceUrl?: Nullable<string>;
    }[]
  >;
  sources?: Nullable<SourceDoc[]>;
  publishedAt?: Nullable<string>;
  updatedAt: string;
}

export interface EventDoc {
  id: number;
  slug: string;
  title: string;
  startsAt: string;
  startsAt_tz: string;
  endsAt: string;
  lifecycle: 'scheduled' | 'cancelled' | 'postponed';
  place?: Nullable<number | PlaceDoc>;
  images?: Nullable<(number | MediaDoc)[]>;
  venueName?: Nullable<string>;
  venueUrl?: Nullable<string>;
  sourceUrl: string;
  fetchedAt: string;
  lastVerifiedAt: string;
  ticketUrl?: Nullable<string>;
}
