import { shouldUseStoredArtistPhoto } from './artist-photo-policy.ts';
import { resolveReviewedArtistPhoto } from './reviewed-artist-photo.ts';

/** Social previews must obey the same source quarantine as visible portraits. */
export function musicArtistOpenGraphPhoto(artist: {
  name: string;
  headshot?: { url: string; sourceUrl: string; altText: string };
}): { url: string; alt: string } | undefined {
  if (shouldUseStoredArtistPhoto(artist) && artist.headshot) {
    return { url: artist.headshot.url, alt: artist.headshot.altText };
  }
  const reviewed = resolveReviewedArtistPhoto(artist.name);
  return reviewed ? { url: reviewed.url, alt: `${artist.name} artist photo` } : undefined;
}
