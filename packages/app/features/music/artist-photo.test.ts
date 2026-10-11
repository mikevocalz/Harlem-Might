import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  artistPhotoProviderLabel,
  normalizeArtistName,
  resolveArtistPhoto,
  resolveArtistPhotos,
  type ArtistPhotoFetch,
} from './artist-photo.ts';

const response = (body: unknown, ok = true) => ({
  ok,
  async json() {
    return body;
  },
});

describe('normalizeArtistName', () => {
  it('matches punctuation-heavy stage names safely', () => {
    assert.equal(normalizeArtistName('A$AP Rocky'), 'asap rocky');
    assert.equal(normalizeArtistName('Ma$e'), 'mase');
    assert.equal(normalizeArtistName('T-Rex'), 't rex');
  });
});

describe('resolveArtistPhoto', () => {
  it('uses an exact Deezer artist-profile match only after reusable image sources miss', async () => {
    const calls: string[] = [];
    const fetcher: ArtistPhotoFetch = async (url) => {
      calls.push(url);
      if (url.startsWith('https://en.wikipedia.org/')) {
        return response({ query: { pages: {} } });
      }
      if (url.startsWith('https://commons.wikimedia.org/')) {
        return response({ query: { pages: {} } });
      }
      assert.match(url, /^https:\/\/api\.deezer\.com\/search\/artist/);
      return response({
        data: [
          {
            id: 1,
            name: "Cam'ron",
            link: 'https://www.deezer.com/artist/1',
            picture_xl:
              'https://e-cdns-images.dzcdn.net/images/artist/camron/1000x1000.jpg',
          },
        ],
      });
    };

    const result = await resolveArtistPhoto("Cam'ron", fetcher);
    assert.equal(result?.provider, 'deezer');
    assert.equal(result?.rightsStatus, 'provider-reference');
    assert.equal(result?.name, "Cam'ron");
    assert.match(result?.url ?? '', /dzcdn\.net/);
    assert.equal(calls.length, 3);
  });

  it('pins T-Rex and Bloodshed to curated correct-person photos', async () => {
    const fetcher: ArtistPhotoFetch = async () => {
      throw new Error('curated overrides must not perform a name search');
    };

    const trex = await resolveArtistPhoto('T-Rex', fetcher);
    assert.equal(trex?.provider, 'curated_web');
    assert.match(trex?.sourceUrl ?? '', /battlerapstats/);

    const bloodshed = await resolveArtistPhoto('Bloodshed', fetcher);
    assert.equal(bloodshed?.provider, 'curated_web');
    assert.match(bloodshed?.sourceUrl ?? '', /xxlmag/);
  });

  it('turns an entity-aware Wikipedia lead image into a licensed Commons result', async () => {
    const calls: string[] = [];
    const fetcher: ArtistPhotoFetch = async (url) => {
      calls.push(url);
      if (url.startsWith('https://api.deezer.com/')) {
        return response({ data: [] });
      }
      if (url.startsWith('https://en.wikipedia.org/')) {
        return response({
          query: {
            pages: {
              '1': {
                pageid: 1,
                title: 'Bill Saxton',
                original: {
                  source:
                    'https://upload.wikimedia.org/wikipedia/commons/1/11/Bill_Saxton.jpg',
                  width: 800,
                  height: 1200,
                },
                terms: {
                  description: ['American jazz saxophonist'],
                },
              },
            },
          },
        });
      }
      if (url.startsWith('https://commons.wikimedia.org/')) {
        return response({
          query: {
            pages: {
              '10': {
                title: 'File:Bill Saxton.jpg',
                imageinfo: [
                  {
                    url:
                      'https://upload.wikimedia.org/wikipedia/commons/1/11/Bill_Saxton.jpg',
                    width: 800,
                    height: 1200,
                    mime: 'image/jpeg',
                    extmetadata: {
                      Artist: { value: 'Example Photographer' },
                      Description: { value: 'Jazz saxophonist Bill Saxton in Harlem.' },
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      LicenseUrl: {
                        value: 'https://creativecommons.org/licenses/by-sa/4.0/',
                      },
                    },
                  },
                ],
              },
            },
          },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    };

    const result = await resolveArtistPhoto('Bill Saxton', fetcher);
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.equal(result?.rightsStatus, 'rights-cleared');
    assert.equal(result?.license, 'CC BY-SA 4.0');
    assert.equal(calls.length, 2);
  });

  it('rejects Commons files whose subject does not match the artist', async () => {
    const fetcher: ArtistPhotoFetch = async (url) => {
      if (url.startsWith('https://api.deezer.com/')) {
        return response({ data: [] });
      }
      if (url.startsWith('https://en.wikipedia.org/')) {
        return response({ query: { pages: {} } });
      }
      return response({
        query: {
          pages: {
            '1': {
              title: 'File:Random astronomy image.jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/1/11/Random_astronomy.jpg',
                  width: 800,
                  height: 1200,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'Bill Saxton' },
                    Description: { value: 'An artist depiction of a galaxy cluster.' },
                    LicenseShortName: { value: 'CC BY 4.0' },
                    LicenseUrl: {
                      value: 'https://creativecommons.org/licenses/by/4.0/',
                    },
                  },
                },
              ],
            },
            '2': {
              title: 'File:Black Ivory In Harlem, N.Y..jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/2/22/Black_Ivory_In_Harlem.jpg',
                  width: 900,
                  height: 1200,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'Vannessajg' },
                    Description: {
                      value:
                        'Leroy Burgess, Stuart Bascombe and Russell Patterson of Black Ivory in Harlem.',
                    },
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                    LicenseUrl: {
                      value: 'https://creativecommons.org/licenses/by-sa/4.0/',
                    },
                  },
                },
              ],
            },
          },
        },
      });
    };

    const result = await resolveArtistPhoto('Stuart Bascombe', fetcher);
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.match(result?.url ?? '', /Black_Ivory/);
    assert.equal(result?.credit, 'Vannessajg');
  });
});

describe('artistPhotoProviderLabel', () => {
  it('labels every supported provider', () => {
    assert.equal(artistPhotoProviderLabel('wikimedia_commons'), 'Wikimedia Commons');
    assert.equal(artistPhotoProviderLabel('deezer'), 'Deezer');
    assert.equal(artistPhotoProviderLabel('curated_web'), 'Verified artist source');
  });
});

it('resolveArtistPhotos preserves every requested artist key', async () => {
  const fetcher: ArtistPhotoFetch = async (url) => {
    if (url.startsWith('https://en.wikipedia.org/')) {
      return response({ query: { pages: {} } });
    }
    if (url.startsWith('https://commons.wikimedia.org/')) {
      return response({ query: { pages: {} } });
    }
    const parsed = new URL(url);
    const name = parsed.searchParams.get('q') ?? 'Artist';
    return response({
      data: [
        {
          name,
          link: 'https://www.deezer.com/artist/1',
          picture_big: `https://e-cdns-images.dzcdn.net/images/artist/${encodeURIComponent(
            name,
          )}/500x500.jpg`,
        },
      ],
    });
  };

  const result = await resolveArtistPhotos(
    ["Cam'ron", 'Big L', 'Ma$e'],
    fetcher,
    2,
  );
  assert.deepEqual(
    Object.keys(result).sort(),
    ['Big L', "Cam'ron", 'Ma$e'].sort(),
  );
  assert.equal(result['Big L']?.provider, 'deezer');
});
