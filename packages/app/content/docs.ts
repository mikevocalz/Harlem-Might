// The document shapes the readers consume, written as the minimum structure
// they need. packages/app must not import Payload or @acme/payload
// (packages/config/eslint/boundaries.mjs: FORBID_BACKEND_DIRECT), so these are
// declared here. The binding in packages/payload/server.ts passes the
// generated `Walk`/`Story`/`Event` documents into these types, so tsc fails
// there if the CMS schema drifts away from this contract.

type Nullable<T> = T | null | undefined;

export interface PlaceDoc {
  id: number;
  slug: string;
  name: string;
}

export interface MediaDoc {
  alt: string;
  url?: Nullable<string>;
  width?: Nullable<number>;
  height?: Nullable<number>;
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
  venueName?: Nullable<string>;
  venueUrl?: Nullable<string>;
  sourceUrl: string;
  fetchedAt: string;
  lastVerifiedAt: string;
  ticketUrl?: Nullable<string>;
}
