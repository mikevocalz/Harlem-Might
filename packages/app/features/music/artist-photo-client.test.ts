import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { artistPhotoEndpoint } from './artist-photo-client.ts';

const keys = ['NEXT_PUBLIC_SITE_URL', 'EXPO_PUBLIC_PAYLOAD_API_BASE', 'EXPO_PUBLIC_APP_URL'] as const;
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});
const clear = () => { for (const key of keys) delete process.env[key]; };

it('uses a same-origin relative API path on the web and encodes artist names', () => {
  clear();
  const path = artistPhotoEndpoint(['A$AP Ant', 'Frankie Lymon & the Teenagers']);
  assert.ok(path.startsWith('/api/music/artist-photo?'));
  const query = new URL(path, 'https://web.example').searchParams;
  assert.equal(query.get('v'), '6');
  assert.equal(query.get('names'), 'A$AP Ant|Frankie Lymon & the Teenagers');
});

it('uses an absolute HTTP origin for mobile and headset clients', () => {
  clear();
  process.env.EXPO_PUBLIC_PAYLOAD_API_BASE = 'https://api.example/api';
  assert.ok(artistPhotoEndpoint(['Big L']).startsWith('https://api.example/api/music/artist-photo?'));
  delete process.env.EXPO_PUBLIC_PAYLOAD_API_BASE;
  process.env.EXPO_PUBLIC_APP_URL = 'https://app.example/app';
  assert.ok(artistPhotoEndpoint(['Big L']).startsWith('https://app.example/api/music/artist-photo?'));
});
