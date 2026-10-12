import { isDisplayableEditorialImage, type EditorialImage } from '@acme/assets';
import type { PlaceRecord } from '../../content/records.ts';
import type { PlaceCatalogueSnapshot } from './catalogue-persistence.ts';
import type { ExplorePlace } from './place-model.ts';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const optional = <T>(value: unknown, check: (value: unknown) => value is T): value is T | undefined =>
  value === undefined || check(value);
const strings = (value: Record<string, unknown>, keys: readonly string[]) => keys.every((key) => isString(value[key]));
const optionalStrings = (value: Record<string, unknown>, keys: readonly string[]) => keys.every((key) => optional(value[key], isString));

// WGS84 tuples are consumed directly by map geometry and distance helpers.
const isPoint = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) && value.length === 2 && isNumber(value[0]) && isNumber(value[1])
  && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;

function isImage(value: unknown): value is EditorialImage {
  return isObject(value)
    && (isString(value.id) || isNumber(value.id))
    && (value.role === 'hero' || value.role === 'gallery' || value.role === 'historical' || value.role === 'thumbnail' || value.role === 'map_pin')
    && (value.source === 'commissioned' || value.source === 'nypl' || value.source === 'loc' || value.source === 'wikimedia_commons'
      || value.source === 'google_places' || value.source === 'unsplash' || value.source === 'pexels' || value.source === 'venue_supplied' || value.source === 'other')
    && strings(value, ['url', 'altText', 'sourceUrl', 'license', 'licenseUrl', 'credit', 'attributionText'])
    && optionalStrings(value, ['creator', 'capturedAt', 'ingestedAt', 'placeholderHash', 'dominantColor', 'caption'])
    && optional(value.width, isNumber) && optional(value.height, isNumber) && optional(value.aspect, isNumber)
    && typeof value.shareAlike === 'boolean' && typeof value.noDerivatives === 'boolean';
}

function isHours(value: unknown): value is NonNullable<PlaceRecord['openingHours']> {
  return isObject(value) && optionalStrings(value, ['osm', 'note', 'sourceUrl', 'verifiedAt']);
}

function isRecordMenu(value: unknown): value is NonNullable<PlaceRecord['menus']>[number] {
  return isObject(value) && isString(value.label) && optionalStrings(value, ['url', 'sourceUrl', 'mealPeriod']);
}

function isRowMenu(value: unknown): value is NonNullable<ExplorePlace['menus']>[number] {
  return isObject(value) && strings(value, ['label', 'url']);
}

function isPlaceRecord(value: unknown): value is PlaceRecord {
  return isObject(value) && isNumber(value.id) && strings(value, ['slug', 'name'])
    && (value.kind === 'business' || value.kind === 'culture' || value.kind === 'historic'
      || value.kind === 'outdoors' || value.kind === 'public-art' || value.kind === 'community')
    && (value.lifecycle === 'open' || value.lifecycle === 'temporarily_closed' || value.lifecycle === 'seasonal'
      || value.lifecycle === 'permanently_closed' || value.lifecycle === 'historical_only' || value.lifecycle === 'unknown')
    && (value.locationAccuracy === 'verified' || value.locationAccuracy === 'approx' || value.locationAccuracy === 'pending')
    && optionalStrings(value, ['category', 'area', 'summary', 'locationSourceUrl', 'locationSourceReadAt', 'address', 'website', 'phone'])
    && optional(value.location, isPoint) && optional(value.openingHours, isHours)
    && (value.menus === undefined || (Array.isArray(value.menus) && value.menus.every(isRecordMenu)))
    && typeof value.featured === 'boolean'
    && Array.isArray(value.images) && value.images.every((image) => isImage(image) && isDisplayableEditorialImage(image));
}

function isExplorePlace(value: unknown): value is ExplorePlace {
  return isObject(value) && strings(value, ['id', 'name', 'category', 'area'])
    && Array.isArray(value.tags) && value.tags.every(isString)
    && optionalStrings(value, ['street', 'shortDescription', 'osm', 'sourceReadAt', 'website', 'phone', 'hoursText'])
    && optional(value.lngLat, isPoint)
    && (value.menus === undefined || (Array.isArray(value.menus) && value.menus.every(isRowMenu)))
    && (value.featured === undefined || typeof value.featured === 'boolean');
}

/**
 * Decode the untrusted native cache before it reaches typed store hydration.
 * Reject the entire snapshot when its envelope or any durable row/detail is
 * malformed, including nested optional fields and mismatched detail slugs.
 * This keeps list/detail authority together rather than falling back to a
 * potentially stale point after discarding a broken authoritative detail.
 * Unknown extra fields are ignored; no missing facts are filled in. Known
 * transient results are discarded, as on save. Unversioned/explicit v1 data
 * stays legacy so hydration can withhold unproven points; only v2 retains
 * list-only coordinates. Unknown versions are rejected, never reinterpreted.
 */
export function decodePlaceCatalogueSnapshot(value: unknown): PlaceCatalogueSnapshot | undefined {
  if (!isObject(value) || !Array.isArray(value.places) || !value.places.every(isExplorePlace)) return undefined;
  const version = value.schemaVersion;
  if (version !== undefined && version !== 1 && version !== 2) return undefined;
  if (value.details !== undefined && !isObject(value.details)) return undefined;
  const details: [string, { status: 'ok'; data: PlaceRecord }][] = [];
  for (const [slug, detail] of Object.entries(value.details ?? {})) {
    if (!isObject(detail)) return undefined;
    if (detail.status === 'not-found' || detail.status === 'unavailable') continue;
    if (detail.status !== 'ok' || !isPlaceRecord(detail.data) || detail.data.slug !== slug) return undefined;
    details.push([slug, { status: 'ok', data: detail.data }]);
  }
  return {
    ...(version === 2 ? { schemaVersion: version } : {}),
    places: value.places,
    details: Object.fromEntries(details),
  };
}
