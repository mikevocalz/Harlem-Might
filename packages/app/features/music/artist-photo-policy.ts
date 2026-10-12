/** Bump both request and React Query keys when reviewed source choices change. */
export const ARTIST_PHOTO_VERSION = '6';

/**
 * Reject only the audited old source assignment, never a future curator upload.
 * These five records need a separate, approved CMS repair. Displaying a reviewed
 * replacement does not rewrite the artist or upload media.
 */
const REJECTED_STORED_SOURCES: Readonly<Record<string, string>> = {
  "Black Ivory": "https://commons.wikimedia.org/wiki/File:Black_Ivory_first_promo_picture.jpg",
  "Dizzy Gillespie": "https://commons.wikimedia.org/wiki/File:(Portrait_of_Dizzy_Gillespie,_New_York,_N.Y.,_between_1946_and_1948)_(LOC)_(4976469817).jpg",
  "Frankie Cutlass": "https://commons.wikimedia.org/wiki/File:Victor_Cruz_And_Frankie_Cutlass.jpg",
  "Harlem Gospel Choir": "https://commons.wikimedia.org/wiki/File:ArtFund_Promo_Photo_Credit_Yvonnetnt.jpg",
  "J. Rosamond Johnson": "https://commons.wikimedia.org/wiki/File:Coleandjohnson.jpg",
};

const sourceIdentity = (value: string): string => {
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase()}${decodeURIComponent(url.pathname).replace(/_/g, ' ')}`;
  } catch {
    return value;
  }
};

export function shouldUseStoredArtistPhoto(artist: {
  name: string;
  headshot?: { sourceUrl: string };
}): boolean {
  if (!artist.headshot) return false;
  const rejected = REJECTED_STORED_SOURCES[artist.name];
  return !rejected || sourceIdentity(artist.headshot.sourceUrl) !== sourceIdentity(rejected);
}

/** Preserve every person in ensemble pictures and the reviewed portrait framing. */
export const artistPhotoFraming = (photo: { width?: number; height?: number }) => ({
  aspectRatio: photo.width && photo.height ? photo.width / photo.height : 4 / 5,
  contentFit: 'contain' as const,
});
