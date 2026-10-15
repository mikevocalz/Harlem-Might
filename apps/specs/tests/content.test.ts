import assert from 'node:assert/strict';
import test from 'node:test';
import { HarlemMightContent, formatEventTime, newYorkDay } from '../Assets/HarlemMight/Scripts/HarlemMightContent.ts';

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

test('resolves relative CMS media URLs against the API origin', async () => {
  const { content } = client({ 'music-artists': { docs: [{ id: 21, name: '40 Cal',
    headshot: { url: '/payload-api/media/file/artist-21-original.jpg', width: 980, height: 735, alt: 'portrait' } }] } });
  const { artists } = await content.musicArtists(1);
  assert.deepEqual(artists[0].image, { url: 'https://example.test/payload-api/media/file/artist-21-original.jpg',
    width: 980, height: 735, alt: 'portrait' });
});
