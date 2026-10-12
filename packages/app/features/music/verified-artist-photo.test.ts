import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VERIFIED_MISSING_ARTIST_NAMES,
  hasVerifiedArtistPhotoSource,
  normalizeVerifiedArtistName,
  resolveVerifiedArtistPhoto,
  resolveVerifiedArtistPhotos,
  type VerifiedArtistPhotoFetch,
} from './verified-artist-photo.ts';

import { CURATED_COMMONS_FILES, CURATED_DIRECT_PHOTOS, CURATED_PROFILE_PAGES, VERIFIED_WIKIPEDIA_TITLES } from './verified-artist-photo-data.ts';

const jsonResponse = (body: unknown, url?: string) => ({
  ok: true,
  url,
  async json() {
    return body;
  },
});

const htmlResponse = (html: string, url: string) => ({
  ok: true,
  url,
  async json() {
    return {};
  },
  async text() {
    return html;
  },
});

describe('verified artist source coverage', () => {
  it('covers all 46 missing catalogue artists exactly once', () => {
    assert.equal(VERIFIED_MISSING_ARTIST_NAMES.length, 46);
    assert.equal(new Set(VERIFIED_MISSING_ARTIST_NAMES).size, 46);
    for (const name of VERIFIED_MISSING_ARTIST_NAMES) {
      const key = normalizeVerifiedArtistName(name);
      assert.equal([CURATED_COMMONS_FILES, CURATED_DIRECT_PHOTOS, CURATED_PROFILE_PAGES, VERIFIED_WIKIPEDIA_TITLES]
        .filter((sources) => Object.hasOwn(sources, key)).length, 1, name);
      assert.equal(
        hasVerifiedArtistPhotoSource(name),
        true,
        `missing explicit photo source for ${name}`,
      );
    }
  });

  it('does not claim arbitrary names are verified', () => {
    assert.equal(hasVerifiedArtistPhotoSource('Definitely Not In Catalogue'), false);
  });

  it('normalizes stage-name punctuation consistently', () => {
    assert.equal(normalizeVerifiedArtistName('A$AP Twelvyy'), 'asap twelvyy');
    assert.equal(normalizeVerifiedArtistName('Ma$e'), 'mase');
    assert.equal(
      normalizeVerifiedArtistName('Frankie Lymon & the Teenagers'),
      'frankie lymon and the teenagers',
    );
  });
});

describe('resolveVerifiedArtistPhoto', () => {
  it('uses an exact Wikipedia title and never generator search for Hazel Scott', async () => {
    const calls: string[] = [];
    const fetcher: VerifiedArtistPhotoFetch = async (url) => {
      calls.push(url);
      if (url.startsWith('https://en.wikipedia.org/')) {
        const parsed = new URL(url);
        assert.equal(parsed.searchParams.get('titles'), 'Hazel Scott');
        assert.equal(parsed.searchParams.get('generator'), null);
        return jsonResponse({
          query: {
            pages: {
              '1': {
                title: 'Hazel Scott',
                original: {
                  source:
                    'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hazel_Scott_1936.jpg',
                },
                terms: { description: ['American jazz pianist'] },
              },
            },
          },
        });
      }
      assert.match(url, /^https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
      return jsonResponse({
        query: {
          pages: {
            '2': {
              title: 'File:Hazel Scott 1936.jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hazel_Scott_1936.jpg',
                  width: 800,
                  height: 1200,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'Carl Van Vechten' },
                    LicenseShortName: { value: 'Public domain' },
                  },
                },
              ],
            },
          },
        },
      });
    };

    const result = await resolveVerifiedArtistPhoto('Hazel Scott', fetcher);
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.equal(result?.rightsStatus, 'rights-cleared');
    assert.equal(calls.length, 2);
  });

  it('uses the exact manual group photo for Frankie Lymon & the Teenagers', async () => {
    const fetcher: VerifiedArtistPhotoFetch = async (url) => {
      const parsed = new URL(url);
      assert.match(parsed.searchParams.get('titles') ?? '', /Frankie Lymon and the Teenagers/);
      return jsonResponse({
        query: {
          pages: {
            '1': {
              title: 'File:Frankie Lymon and the Teenagers.jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/6/66/Frankie_Lymon_and_the_Teenagers.jpg',
                  width: 1083,
                  height: 1252,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'Gee Records' },
                    LicenseShortName: { value: 'Public domain' },
                  },
                },
              ],
            },
          },
        },
      });
    };

    const result = await resolveVerifiedArtistPhoto(
      'Frankie Lymon & the Teenagers',
      fetcher,
    );
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.match(result?.sourceUrl ?? '', /Frankie_Lymon_and_the_Teenagers/);
  });

  it('uses the pinned James P. Johnson photo instead of the encyclopedia GIF', async () => {
    const fetcher: VerifiedArtistPhotoFetch = async (url) => {
      assert.match(url, /^https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
      const title = new URL(url).searchParams.get('titles') ?? '';
      assert.match(title, /James P\. \(James Price\) Johnson and Marty Marsala/);
      return jsonResponse({
        query: {
          pages: {
            '1': {
              title:
                'File:(Portrait of James P. (James Price) Johnson and Marty Marsala, Riverboat on the Hudson, N.Y., ca. July 1947) (LOC) (5436424030).jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/example/james-p-johnson.jpg',
                  width: 1024,
                  height: 1048,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'William P. Gottlieb' },
                    LicenseShortName: { value: 'Public domain' },
                  },
                },
              ],
            },
          },
        },
      });
    };

    const result = await resolveVerifiedArtistPhoto('James P. Johnson', fetcher);
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.doesNotMatch(result?.url ?? '', /\.gif/i);
  });

  it('extracts a vetted artist-profile image for Big L', async () => {
    const page = 'https://www.last.fm/music/Big%2BL';
    const fetcher: VerifiedArtistPhotoFetch = async (url) => {
      assert.equal(url, page);
      return htmlResponse(
        '<html><head><meta property="og:title" content="Big L music, videos, stats, and photos | Last.fm"><meta property="og:image" content="https://rovimusic.example/big-l-ricky-powell.jpg"></head></html>',
        page,
      );
    };

    const result = await resolveVerifiedArtistPhoto('Big L', fetcher);
    assert.equal(result?.provider, 'curated_web');
    assert.equal(result?.rightsStatus, 'provider-reference');
    assert.equal(result?.sourceUrl, page);
    assert.match(result?.url ?? '', /big-l-ricky-powell/);
  });

  it('rejects generic profile logos rather than showing the wrong image', async () => {
    const page = 'https://www.last.fm/music/Black%2BRob';
    const fetcher: VerifiedArtistPhotoFetch = async () =>
      htmlResponse(
        '<meta property="og:title" content="Black Rob music, videos, stats, and photos | Last.fm"><meta property="og:image" content="https://static.example/allmusic-logo.png">',
        page,
      );

    const result = await resolveVerifiedArtistPhoto('Black Rob', fetcher);
    assert.equal(result, undefined);
  });

  it('keeps every requested verified key when batching', async () => {
    const fetcher: VerifiedArtistPhotoFetch = async (url) => {
      if (url.startsWith('https://en.wikipedia.org/')) {
        return jsonResponse({ query: { pages: {} } });
      }
      if (url.startsWith('https://commons.wikimedia.org/')) {
        return jsonResponse({ query: { pages: {} } });
      }
      return htmlResponse('', url);
    };

    const names = ['Bessie Smith', 'Big L', 'Black Rob'] as const;
    const result = await resolveVerifiedArtistPhotos(names, fetcher, 2);
    assert.deepEqual(Object.keys(result).sort(), [...names].sort());
  });
});

describe('verified photo identity boundaries', () => {
  const profile = 'https://www.last.fm/music/Big%2BL';
  const image = 'https://cdn.example/big-l.jpg';

  it('rejects retired profile redirects and unrelated homepage metadata', async () => {
    for (const finalUrl of ['https://www.last.fm/', 'https://www.last.fm/music/Someone+Else']) {
      const photo = await resolveVerifiedArtistPhoto('Big L', async () =>
        htmlResponse(`<meta property="og:title" content="Big L music, videos and photos"><meta property="og:image" content="${image}">`, finalUrl));
      assert.equal(photo, undefined);
    }
    const photo = await resolveVerifiedArtistPhoto('Big L', async () =>
      htmlResponse(`<meta property="og:title" content="Music for everyone"><meta property="og:image" content="${image}">`, profile));
    assert.equal(photo, undefined);
  });

  it('requires an exact artist image label rather than a substring match', async () => {
    for (const alt of ['Big Love', 'Big L and Jay-Z', 'Big L album cover', 'Not Big L']) {
      const photo = await resolveVerifiedArtistPhoto('Big L', async () =>
        htmlResponse(`<img alt="${alt}" src="${image}">`, profile));
      assert.equal(photo, undefined, alt);
    }
    const photo = await resolveVerifiedArtistPhoto('Big L', async () =>
      htmlResponse(`<img alt="Portrait of Big L" src="${image}">`, profile));
    assert.equal(photo?.url, image);
    assert.equal(photo?.rightsStatus, 'provider-reference');
    assert.equal(photo?.license, undefined);
  });

  it('never treats inherited object properties as reviewed sources', async () => {
    for (const name of ['constructor', 'toString', '__proto__']) {
      assert.equal(hasVerifiedArtistPhotoSource(name), false);
      assert.equal(await resolveVerifiedArtistPhoto(name, async () => { throw new Error('must not fetch'); }), undefined);
    }
  });

  it('requires the exact pinned Commons file and explicit compatible licensing', async () => {
    for (const [title, license] of [
      ['File:Other Person.jpg', 'Public domain'],
      ['File:BessieSmith.jpg', undefined],
      ['File:BessieSmith.jpg', 'CC-BY-NC 4.0'],
      ['File:BessieSmith.jpg', 'CC BY-ND 4.0'],
      ['File:BessieSmith.jpg', 'CC BY 4.0'], // Missing required creator attribution.
    ]) {
      const photo = await resolveVerifiedArtistPhoto('Bessie Smith', async () => jsonResponse({ query: { pages: {
        1: { title, imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/BessieSmith.jpg', mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: license } } }] },
      } } }));
      assert.equal(photo, undefined, `${title}: ${license}`);
    }
  });

  it('isolates upstream failure without omitting requested batch keys', async () => {
    const photos = await resolveVerifiedArtistPhotos(['Big L', 'Bloodshed'], async () => { throw new Error('timeout'); }, 2);
    assert.equal(photos['Big L'], null);
    assert.equal(photos.Bloodshed?.rightsStatus, 'provider-reference');
    assert.equal(photos.Bloodshed?.license, undefined);
  });
});

it('preserves reviewed institutional and official profile title formats', async () => {
  for (const [name, page, title] of [
    ['Cameo', 'https://www.cameonation.com/', 'CAMEONATION | Larry Blackmon / CAMEO Official Site'],
    ['Charlie Palmieri', 'https://fania.com/artist/charlie-palmieri/', 'Charlie Palmieri - Fania Records'],
    ['Harlem Quartet', 'https://www.harlemquartet.com/', 'Harlem Quartet'],
    ['DJ Hollywood', 'https://mrbellersneighborhood.com/2023/03/harlem-superstar-dj-hollywood', "Harlem Superstar: DJ Hollywood | Mr. Beller's Neighborhood"],
  ] as const) {
    const result = await resolveVerifiedArtistPhoto(name, async () =>
      htmlResponse(`<title>${title}</title><meta property="og:image" content="https://cdn.example/portrait.jpg">`, page));
    assert.equal(result?.url, 'https://cdn.example/portrait.jpg', name);
  }
});

it('preserves object-property names as explicit empty batch results', async () => {
  const names = ['__proto__', 'constructor', 'toString', 'Unknown Artist'];
  const photos = await resolveVerifiedArtistPhotos(names, async () => { throw new Error('must not fetch'); });
  assert.deepEqual(Object.keys(photos).sort(), names.sort());
  for (const name of names) {
    assert.equal(Object.hasOwn(photos, name), true, name);
    assert.equal(photos[name], null, name);
  }
  assert.equal(Object.getPrototypeOf(photos), Object.prototype);
});
