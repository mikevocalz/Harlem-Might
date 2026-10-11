import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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
  it('uses an exact Deezer artist-profile match for a real artist photo', async () => {
    const fetcher: ArtistPhotoFetch = async (url) => {
      assert.match(url, /^https:\/\/api\.deezer\.com\/search\/artist/);
      return response({
        data: [
          {
            id: 1,
            name: "Cam'ron",
            link: 'https://www.deezer.com/artist/1',
            picture_xl: 'https://e-cdns-images.dzcdn.net/images/artist/camron/1000x1000.jpg',
          },
        ],
      });
    };

    const result = await resolveArtistPhoto("Cam'ron", fetcher);
    assert.equal(result?.provider, 'deezer');
    assert.equal(result?.name, "Cam'ron");
    assert.match(result?.url ?? '', /dzcdn\.net/);
  });

  it('skips Deezer for an ambiguous stage name and uses a Commons photo instead', async () => {
    const calls: string[] = [];
    const fetcher: ArtistPhotoFetch = async (url) => {
      calls.push(url);
      return response({
        query: {
          pages: {
            '1': {
              title: 'File:T-Rex rapper portrait.jpg',
              imageinfo: [
                {
                  url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/T-Rex_rapper_portrait.jpg',
                  width: 800,
                  height: 1200,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'Example Photographer' },
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                    LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
                  },
                },
              ],
            },
          },
        },
      });
    };

    const result = await resolveArtistPhoto('T-Rex', fetcher);
    assert.equal(calls.length, 1);
    assert.match(calls[0] ?? '', /^https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
    assert.equal(result?.provider, 'wikimedia_commons');
    assert.equal(result?.credit, 'Example Photographer');
    assert.equal(result?.license, 'CC BY-SA 4.0');
  });

  it('rejects logos/signatures when choosing from Commons results', async () => {
    const fetcher: ArtistPhotoFetch = async () =>
      response({
        query: {
          pages: {
            '1': {
              title: 'File:Bloodshed logo.png',
              imageinfo: [
                {
                  url: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Bloodshed_logo.png',
                  width: 900,
                  height: 300,
                  mime: 'image/png',
                  extmetadata: {},
                },
              ],
            },
            '2': {
              title: 'File:Bloodshed rapper portrait.jpg',
              imageinfo: [
                {
                  url: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Bloodshed_rapper_portrait.jpg',
                  width: 900,
                  height: 1200,
                  mime: 'image/jpeg',
                  extmetadata: {
                    Artist: { value: 'Photographer' },
                    LicenseShortName: { value: 'CC BY 2.0' },
                    LicenseUrl: { value: 'https://creativecommons.org/licenses/by/2.0/' },
                  },
                },
              ],
            },
          },
        },
      });

    const result = await resolveArtistPhoto('Bloodshed', fetcher);
    assert.match(result?.url ?? '', /portrait/);
  });
});

it('resolveArtistPhotos preserves every requested artist key', async () => {
  const fetcher: ArtistPhotoFetch = async (url) => {
    const parsed = new URL(url);
    const name = parsed.searchParams.get('q') ?? 'Artist';
    return response({
      data: [{
        name,
        link: 'https://www.deezer.com/artist/1',
        picture_big: `https://e-cdns-images.dzcdn.net/images/artist/${encodeURIComponent(name)}/500x500.jpg`,
      }],
    });
  };

  const result = await resolveArtistPhotos(['Cam\'ron', 'Big L', 'Ma$e'], fetcher, 2);
  assert.deepEqual(Object.keys(result).sort(), ['Big L', "Cam'ron", 'Ma$e'].sort());
  assert.equal(result['Big L']?.provider, 'deezer');
});
