import assert from 'node:assert/strict';
import test from 'node:test';
import { HARLEM_ARCHIVAL_IMAGES, isDisplayableEditorialImage, mapEditorialImages } from './editorial-images.ts';
import type { EventDoc, MediaDoc, PlaceDoc, StoryDoc, WalkDoc } from './docs.ts';
import { mapEvent, mapPlaceRef, mapStory, mapWalk } from './map.ts';

const licensedMedia: MediaDoc = {
  id: 17,
  alt: 'A documented editorial photograph.',
  url: 'https://example.org/photo.jpg',
  width: 760,
  height: 510,
  role: 'hero',
  source: 'other',
  sourceUrl: 'https://example.org/source',
  license: 'Example license',
  licenseUrl: 'https://example.org/license',
  creator: 'Example photographer',
  credit: 'Example photographer',
  attributionText: 'Photograph by Example photographer',
  capturedAt: '2026',
  ingestedAt: '2026-10-09T00:00:00.000Z',
  placeholderHash: 'hash-from-ingest',
  dominantColor: '#6E6254',
  shareAlike: false,
  noDerivatives: false,
};

test('maps only populated images with complete rights and attribution provenance', () => {
  const [image] = mapEditorialImages([licensedMedia, 18, { ...licensedMedia, id: 19, license: null }]);

  assert.deepEqual(image, {
    id: 17,
    role: 'hero',
    url: licensedMedia.url,
    altText: licensedMedia.alt,
    source: 'other',
    sourceUrl: licensedMedia.sourceUrl,
    license: licensedMedia.license,
    licenseUrl: licensedMedia.licenseUrl,
    creator: licensedMedia.creator,
    credit: licensedMedia.credit,
    attributionText: licensedMedia.attributionText,
    capturedAt: licensedMedia.capturedAt,
    ingestedAt: licensedMedia.ingestedAt,
    width: 760,
    height: 510,
    aspect: 760 / 510,
    placeholderHash: licensedMedia.placeholderHash,
    dominantColor: licensedMedia.dominantColor,
    shareAlike: false,
    noDerivatives: false,
  });
});

test('rejects images without a licensable source or visible creator credit', () => {
  const [image] = mapEditorialImages([licensedMedia]);
  assert.ok(image);

  assert.equal(isDisplayableEditorialImage({ ...image, sourceUrl: undefined }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, licenseUrl: undefined }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, credit: undefined }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, attributionText: undefined }), false);
  assert.deepEqual(mapEditorialImages([{ ...licensedMedia, sourceUrl: null }]), []);
});

test('the Harlem archive image is tied to the NYPL item and carries its exact attribution limits', () => {
  const [image] = HARLEM_ARCHIVAL_IMAGES;

  assert.equal(image?.sourceUrl, 'https://digitalcollections.nypl.org/items/e687af30-c6e8-012f-2a82-3c075448cc4b?canvasIndex=0');
  assert.equal(image?.creator, 'Sid Grossman, 1915–1955');
  assert.equal(image?.capturedAt, '1939');
  assert.equal(image?.attributionText, 'From The New York Public Library');
  assert.match(image?.license ?? '', /public domain under the laws of the United States/i);
  assert.match(image?.license ?? '', /did not make a determination/i);
  assert.equal(isDisplayableEditorialImage(image), true);
});

test('place, walk, story and event records carry the same rights-gated images', () => {
  const placeDoc: PlaceDoc = {
    id: 7,
    slug: 'example-place',
    name: 'Example Place',
    kind: 'culture',
    lifecycle: 'unknown',
    locationAccuracy: 'pending',
    images: [licensedMedia],
  };
  const walkDoc: WalkDoc = {
    id: 1,
    slug: 'example-walk',
    title: 'Example Walk',
    summary: 'A walk.',
    stops: [{ place: placeDoc }],
    distanceMeters: 1000,
    durationMinutes: 30,
    startDescription: 'Start',
    endDescription: 'End',
    images: [licensedMedia],
    updatedAt: '2026-10-09T00:00:00.000Z',
  };
  const storyDoc: StoryDoc = {
    id: 2,
    slug: 'example-story',
    title: 'Example Story',
    body: 'A story.',
    author: 'Example Author',
    places: [placeDoc],
    images: [licensedMedia],
    updatedAt: '2026-10-09T00:00:00.000Z',
  };
  const eventDoc: EventDoc = {
    id: 3,
    slug: 'example-event',
    title: 'Example Event',
    startsAt: '2026-10-09T18:00:00.000Z',
    startsAt_tz: 'America/New_York',
    endsAt: '2026-10-09T20:00:00.000Z',
    lifecycle: 'scheduled',
    place: placeDoc,
    images: [licensedMedia],
    sourceUrl: 'https://example.org/listing',
    fetchedAt: '2026-10-09T00:00:00.000Z',
    lastVerifiedAt: '2026-10-09T00:00:00.000Z',
  };

  const place = mapPlaceRef(placeDoc);
  const walk = mapWalk(walkDoc);
  const story = mapStory(storyDoc);
  const event = mapEvent(eventDoc);

  assert.equal(place?.images?.[0]?.id, licensedMedia.id);
  assert.equal(walk.images[0]?.id, licensedMedia.id);
  assert.equal(walk.stops[0]?.place?.images?.[0]?.id, licensedMedia.id);
  assert.equal(story.images[0]?.id, licensedMedia.id);
  assert.equal(story.places[0]?.images?.[0]?.id, licensedMedia.id);
  assert.equal(event.images[0]?.id, licensedMedia.id);
  assert.equal(event.place?.images?.[0]?.id, licensedMedia.id);
  assert.deepEqual(mapWalk({ ...walkDoc, images: [{ ...licensedMedia, attributionText: null }] }).images, []);
});
