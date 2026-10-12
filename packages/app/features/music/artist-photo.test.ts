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
  it('does not treat inherited keys as curated photos, files or encyclopedia aliases', async () => {
    for (const name of ['constructor', '__proto__', 'toString', 'Unknown Artist']) {
      const calls: URL[] = [];
      const photo = await resolveArtistPhoto(name, async (url) => {
        calls.push(new URL(url));
        return response({ query: { pages: {} } });
      });
      assert.equal(photo, undefined, name);
      assert.equal(calls.length, 1, name);
      assert.equal(calls[0]!.hostname, 'en.wikipedia.org');
      assert.equal(calls[0]!.searchParams.get('titles'), null);
      assert.equal(calls[0]!.searchParams.get('gsrsearch'), `"${name}" musician`);
    }
  });

  it('does not fall back to fuzzy Commons or same-name streaming profiles', async () => {
    const calls: string[] = [];
    const fetcher: ArtistPhotoFetch = async (url) => {
      calls.push(url);
      assert.match(url, /^https:\/\/en\.wikipedia\.org\/w\/api\.php/);
      return response({ query: { pages: {} } });
    };

    const result = await resolveArtistPhoto('Spoonie Gee', fetcher);
    assert.equal(result, undefined);
    assert.equal(calls.length, 1);
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

  it('turns an exact music-entity Wikipedia lead image into a licensed Commons result', async () => {
    const calls: string[] = [];
    const fetcher: ArtistPhotoFetch = async (url) => {
      calls.push(url);
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

  it('rejects a same-name non-musician instead of accepting partial title overlap', async () => {
    const fetcher: ArtistPhotoFetch = async (url) => {
      assert.match(url, /^https:\/\/en\.wikipedia\.org\/w\/api\.php/);
      return response({
        query: {
          pages: {
            '1': {
              pageid: 1,
              title: 'John Smith',
              original: {
                source:
                  'https://upload.wikimedia.org/wikipedia/commons/a/aa/John_Smith_explorer.jpg',
              },
              terms: { description: ['English explorer'] },
            },
          },
        },
      });
    };

    const result = await resolveArtistPhoto('John Smith', fetcher);
    assert.equal(result, undefined);
  });

  it('rejects signatures, logos and other non-photo Commons lead media', async () => {
    const fetcher: ArtistPhotoFetch = async (url) => {
      if (url.startsWith('https://en.wikipedia.org/')) {
        return response({
          query: {
            pages: {
              '1': {
                pageid: 1,
                title: 'Big L',
                original: {
                  source:
                    'https://upload.wikimedia.org/wikipedia/commons/1/11/Big_L_signature.png',
                },
                terms: { description: ['American rapper'] },
              },
            },
          },
        });
      }
      return response({
        query: {
          pages: {
            '10': {
              title: 'File:Big L signature.png',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/1/11/Big_L_signature.png',
                  width: 424,
                  height: 147,
                  mime: 'image/png',
                  extmetadata: {
                    Artist: { value: 'Lamont Coleman' },
                    LicenseShortName: { value: 'Public domain' },
                  },
                },
              ],
            },
          },
        },
      });
    };

    const result = await resolveArtistPhoto('Spoonie Gee', fetcher);
    assert.equal(result, undefined);
  });

  it('uses a manually verified Commons file for Charles Hamilton the rapper', async () => {
    const calls: string[] = [];
    const fetcher: ArtistPhotoFetch = async (url) => {
      calls.push(url);
      assert.match(url, /^https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
      return response({
        query: {
          pages: {
            '1': {
              title: 'File:Charles Hamilton (rapper).jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/a/ab/Charles_Hamilton_rapper.jpg',
                  width: 955,
                  height: 778,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'yoo toob' },
                    LicenseShortName: { value: 'CC BY 3.0' },
                    LicenseUrl: {
                      value: 'https://creativecommons.org/licenses/by/3.0/',
                    },
                  },
                },
              ],
            },
          },
        },
      });
    };

    const result = await resolveArtistPhoto('Charles Hamilton', fetcher);
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.match(result?.sourceUrl ?? '', /Charles_Hamilton/);
    assert.equal(calls.length, 1);
  });

  it('uses the verified group photo for Frankie Lymon & the Teenagers', async () => {
    const fetcher: ArtistPhotoFetch = async (url) => {
      assert.match(url, /^https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
      return response({
        query: {
          pages: {
            '1': {
              title: 'File:Frankie Lymon and the Teenagers.jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/f/f0/Frankie_Lymon_and_the_Teenagers.jpg',
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

    const result = await resolveArtistPhoto(
      'Frankie Lymon & the Teenagers',
      fetcher,
    );
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.match(result?.sourceUrl ?? '', /Frankie_Lymon_and_the_Teenagers/);
  });
});

describe('artistPhotoProviderLabel', () => {
  it('labels every supported provider', () => {
    assert.equal(
      artistPhotoProviderLabel('wikimedia_commons'),
      'Wikimedia Commons',
    );
    assert.equal(
      artistPhotoProviderLabel('curated_web'),
      'Verified artist source',
    );
  });
});

it('resolveArtistPhotos preserves every requested artist key and leaves unverified matches empty', async () => {
  const fetcher: ArtistPhotoFetch = async (url) => {
    if (url.startsWith('https://en.wikipedia.org/')) {
      return response({ query: { pages: {} } });
    }
    return response({ query: { pages: {} } });
  };

  const result = await resolveArtistPhotos(
    ["Cam'ron", 'Spoonie Gee', 'Ma$e'],
    fetcher,
    2,
  );
  assert.deepEqual(
    Object.keys(result).sort(),
    ['Spoonie Gee', "Cam'ron", 'Ma$e'].sort(),
  );
  assert.equal(result['Spoonie Gee'], null);
  assert.equal(result["Cam'ron"], null);
});

it('preserves special object-property names as own batch results', async () => {
  const names = ['__proto__', 'constructor', 'toString', 'Unknown Artist'];
  const photos = await resolveArtistPhotos(names, async () => response({ query: { pages: {} } }));
  assert.deepEqual(Object.keys(photos).sort(), names.sort());
  for (const name of names) {
    assert.equal(Object.hasOwn(photos, name), true, name);
    assert.equal(photos[name], null, name);
  }
  assert.equal(Object.getPrototypeOf(photos), Object.prototype);
});
