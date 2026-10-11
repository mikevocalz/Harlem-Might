import type { MusicConnection } from '@acme/app/content';

/** Plain-English connection labels; the CMS stores enum keys. */
export const musicConnectionLabel = (connection: MusicConnection): string => {
  switch (connection) {
    case 'born-raised':
      return 'Born or raised in Harlem';
    case 'resident':
      return 'Harlem resident';
    case 'scene':
      return 'Harlem music-scene figure';
    case 'east-harlem':
      return 'East Harlem / El Barrio';
  }
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The 11-char video id from a watch, share or embed URL. Regex-only: Hermes
 * has no reliable URL parser, and the CMS validation already restricts stored
 * values to the youtube.com/watch and youtu.be forms.
 */
export const youTubeVideoId = (url: string): string | undefined => {
  const watch = url.match(/^[?&].*v=([A-Za-z0-9_-]{11})(?:[&#]|$)|[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/);
  const direct = watch?.[1] ?? watch?.[2];
  if (direct) return direct;
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short?.[1]) return short[1];
  const embed = url.match(/youtube(-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/);
  return embed?.[2] && YOUTUBE_ID.test(embed[2]) ? embed[2] : undefined;
};

/** The privacy-enhanced embed URL for a stored watch/share URL; undefined if unparseable. */
export const youTubeEmbedUrl = (url: string): string | undefined => {
  const id = youTubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : undefined;
};

/**
 * A YouTube-hosted high-resolution thumbnail for the artist's own featured
 * performance. This is presentation fallback media, not a CMS headshot and
 * must never be credited as a portrait.
 */
export const youTubeThumbnailUrl = (url: string): string | undefined => {
  const id = youTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
};

/** The plain-text biography as paragraphs (blank-line separated in the CMS). */
export const biographyParagraphs = (biography: string): string[] =>
  biography
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
