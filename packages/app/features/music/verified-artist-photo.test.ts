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
  it('uses an exact Wikipedia title and never generator search for Bessie Smith', async () => {
    const calls: string[] = [];
    const fetcher: VerifiedArtistPhotoFetch = async (url) => {
      calls.push(url);
      if (url.startsWith('https://en.wikipedia.org/')) {
        const parsed = new URL(url);
        assert.equal(parsed.searchParams.get('titles'), 'Bessie Smith');
        assert.equal(parsed.searchParams.get('generator'), null);
        return jsonResponse({
          query: {
            pages: {
              '1': {
                title: 'Bessie Smith',
                original: {
                  source:
                    'https://upload.wikimedia.org/wikipedia/commons/d/d0/Bessie_Smith_1936.jpg',
                },
                terms: { description: ['American blues singer'] },
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
              title: 'File:Bessie Smith 1936.jpg',
              imageinfo: [
                {
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/d/d0/Bessie_Smith_1936.jpg',
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

    const result = await resolveVerifiedArtistPhoto('Bessie Smith', fetcher);
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
    const page = 'https://www.allmusic.com/artist/big-l-mn0000055456';
    const fetcher: VerifiedArtistPhotoFetch = async (url) => {
      assert.equal(url, page);
      return htmlResponse(
        '<html><head><meta property="og:image" content="https://rovimusic.example/big-l-ricky-powell.jpg"></head></html>',
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
    const page = 'https://www.allmusic.com/artist/black-rob-mn0000094813';
    const fetcher: VerifiedArtistPhotoFetch = async () =>
      htmlResponse(
        '<meta property="og:image" content="https://static.example/allmusic-logo.png">',
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
