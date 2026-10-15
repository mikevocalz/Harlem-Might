import assert from 'node:assert/strict';
import test from 'node:test';
import { HarlemMightContent, formatEventTime, formatEventWhen, formatStoryDate, newYorkDay, placeRowLine, shouldUseStoredArtistPhoto, storyParagraphs, todayHeading } from '../Assets/HarlemMight/Scripts/HarlemMightContent.ts';

function client(bodies: Record<string, unknown>) {
  const urls: string[] = [];
  const content = new HarlemMightContent('https://example.test/payload-api/', async (url) => {
    urls.push(url);
    const collection = url.split('/payload-api/')[1].split('?')[0];
    return bodies[collection] ?? { docs: [] };
  });
  return { content, urls };
}

test('reads the same published collections and sort orders as the mobile readers', async () => {
  const { content, urls } = client({});
  await content.walks();
  await content.stories();
  await content.musicArtists(2);
  await content.featuredPlaces();
  assert.equal(urls[0], 'https://example.test/payload-api/walks?where[_status][equals]=published&depth=1&limit=100&sort=-updatedAt&draft=false');
  assert.equal(urls[1], 'https://example.test/payload-api/stories?where[_status][equals]=published&depth=1&limit=100&sort=-publishedAt&draft=false');
  assert.equal(urls[2], 'https://example.test/payload-api/music-artists?where[_status][equals]=published&depth=1&limit=24&sort=name,id&page=2&draft=false');
  assert.match(urls[3], /places\?where\[featured\]\[equals\]=true&depth=1&limit=24&sort=name&select\[slug\]=true/);
});

test('maps Payload [lng, lat] points and the first address segment as the street', async () => {
  const { content } = client({ places: { docs: [{ id: 1, name: 'Apollo Theater', primaryCategory: 'Culture',
    location: [-73.95, 40.81], address: { formatted: '253 West 125th Street, New York, NY' } }] } });
  const [place] = await content.featuredPlaces();
  assert.deepEqual([place.latitude, place.longitude, place.street], [40.81, -73.95, '253 West 125th Street']);
});

test('formats walk facts like walkSummaryLine on mobile', async () => {
  const { content } = client({ walks: { docs: [{ id: 3, title: 'Lenox', distanceMeters: 1958, durationMinutes: 54,
    stops: [{ place: { id: 9, name: 'Schomburg Center', location: [-73.94, 40.81] } }, { place: 10 }, { place: 11 }] }] } });
  const [walk] = await content.walks();
  assert.equal(walk.facts, '1.2 miles, 54 min, 3 stops');
  assert.equal(walk.firstStop?.name, 'Schomburg Center');
});

test('Today falls back to the next 90 days when today has no events', async () => {
  const { content, urls } = client({});
  const result = await content.todayEvents(new Date('2026-10-15T02:30:00Z'));
  assert.equal(result.upcoming, true);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /startsAt\]\[less_than\]=2026-10-15T04%3A00%3A00.000Z/);
  assert.match(urls[1], /startsAt\]\[less_than\]=2027-01-12T04%3A00%3A00.000Z/);
});

test('New York days and times follow US Eastern daylight time', () => {
  assert.equal(newYorkDay(new Date('2026-10-15T02:30:00Z'))[0].toISOString(), '2026-10-14T04:00:00.000Z');
  assert.equal(newYorkDay(new Date('2026-01-10T12:00:00Z'))[0].toISOString(), '2026-01-10T05:00:00.000Z');
  assert.equal(formatEventTime('2026-10-15T14:00:00.000Z'), 'Thu Oct 15 · 10:00 AM');
  assert.equal(formatEventTime('2026-01-10T00:30:00.000Z'), 'Fri Jan 9 · 7:30 PM');
});

test('resolves relative CMS media URLs against the API origin, with the mobile credit line', async () => {
  const { content } = client({ 'music-artists': { docs: [{ id: 21, name: '40 Cal', connection: 'scene',
    biography: 'First.\n\nSecond.',
    headshot: { url: '/payload-api/media/file/artist-21-original.jpg', width: 980, height: 735, alt: 'portrait',
      credit: 'Masar Tv', license: 'CC BY 3.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:40_Cal.jpg' } }] } });
  const [artist] = (await content.musicArtists(1)).artists;
  assert.deepEqual(artist.image, { url: 'https://example.test/payload-api/media/file/artist-21-original.jpg',
    width: 980, height: 735, alt: 'portrait', credit: 'Masar Tv · CC BY 3.0' });
  assert.equal(artist.connection, 'Harlem music-scene figure');
  assert.deepEqual(artist.biography, ['First.', 'Second.']);
});

test('rejects the stored headshots the mobile policy rejects', () => {
  assert.equal(shouldUseStoredArtistPhoto('Black Ivory',
    { sourceUrl: 'https://commons.wikimedia.org/wiki/File:Black Ivory first promo picture.jpg' }), false);
  assert.equal(shouldUseStoredArtistPhoto('Big L', { sourceUrl: 'https://example.test/x.jpg' }), true);
  assert.equal(shouldUseStoredArtistPhoto('Big L', undefined), false);
});

test('asks the site photo service for missing portraits like artist-photo-client', async () => {
  const urls: string[] = [];
  const content = new HarlemMightContent('https://example.test/payload-api', async (url) => {
    urls.push(url);
    return { photos: { 'A$AP Ant': { url: 'https://example.test/api/music/artist-photo/image?name=A%24AP%20Ant&v=6',
      provider: 'curated_web', credit: 'Last.fm A$AP Ant artist profile', width: 1080, height: 1080 } } };
  });
  const photos = await content.artistPhotos(['A$AP Ant', 'Nobody']);
  assert.equal(urls[0], 'https://example.test/api/music/artist-photo?v=6&names=A%24AP%20Ant%7CNobody');
  assert.equal(photos['A$AP Ant']?.credit, 'Last.fm A$AP Ant artist profile · Verified artist source · external reference');
  assert.equal(photos.Nobody, null);
});

// Mobile formats these with Intl in America/New_York; Lens has no time zones,
// so the port must produce the same strings.
const intlRange = (s: string, e: string, showDate = false) => {
  const tz = 'America/New_York';
  const day = (d: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(d));
  return new Intl.DateTimeFormat('en-US', { timeZone: tz,
    ...(day(s) === day(e) && !showDate ? {} : { month: 'short', day: 'numeric' }),
    ...(showDate ? { year: 'numeric' } : {}), hour: 'numeric', minute: '2-digit' })
    .formatRange(new Date(s), new Date(e)).replace(/[\u2009\u202f]/g, ' ');
};

test('event times match eventWhen on mobile', () => {
  for (const [s, e, d] of [['2026-10-15T14:00:00Z', '2026-10-15T16:00:00Z', false],
    ['2026-10-15T23:30:00Z', '2026-10-16T02:00:00Z', false], ['2026-10-15T14:00:00Z', '2026-10-18T22:00:00Z', false],
    ['2026-12-01T20:00:00Z', '2026-12-01T22:00:00Z', true], ['2026-10-15T15:00:00Z', '2026-10-15T15:00:00Z', false]] as const) {
    assert.equal(formatEventWhen(s, e, d), intlRange(s, e, d), s + ' to ' + e);
  }
});

test('story dates, Today heading, place rows and story paragraphs match mobile', () => {
  assert.equal(formatStoryDate('2026-10-03T02:00:00Z'), 'Oct 2, 2026');
  assert.equal(todayHeading(new Date('2026-10-09T15:00:00Z')), 'Friday, October 9th');
  assert.equal(todayHeading(new Date('2026-10-22T15:00:00Z')), 'Thursday, October 22nd');
  assert.equal(todayHeading(new Date('2026-10-11T15:00:00Z')), 'Sunday, October 11th');
  const place = { id: '1', name: 'X', category: 'Culture', street: '', area: 'Harlem', summary: '',
    latitude: null, longitude: null, image: null };
  assert.equal(placeRowLine(place), 'Culture, Harlem, location pending');
  assert.deepEqual(storyParagraphs('One\nline.\n \nTwo.'), ['One line.', 'Two.']);
});
