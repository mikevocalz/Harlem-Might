export type ArtistPhotoProvider =
  | 'wikimedia_commons'
  | 'curated_web';

export type ArtistPhotoResult = {
  name: string;
  url: string;
  sourceUrl: string;
  provider: ArtistPhotoProvider;
  rightsStatus: 'rights-cleared' | 'provider-reference';
  credit: string;
  license?: string;
  licenseUrl?: string;
  width?: number;
  height?: number;
};

export const normalizeArtistName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$/g, 's')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const isArtistPhotoResult = (
  value: unknown,
): value is ArtistPhotoResult => {
  const object = asObject(value);
  const provider = asString(object?.provider);
  return Boolean(
    asString(object?.name) &&
      asString(object?.url) &&
      asString(object?.sourceUrl) &&
      asString(object?.credit) &&
      (object?.rightsStatus === 'rights-cleared' ||
        object?.rightsStatus === 'provider-reference') &&
      (provider === 'wikimedia_commons' || provider === 'curated_web'),
  );
};

export const artistPhotoProviderLabel = (
  provider: ArtistPhotoProvider,
): string => {
  switch (provider) {
    case 'wikimedia_commons':
      return 'Wikimedia Commons';
    case 'curated_web':
      return 'Verified artist source';
  }
};

/** The curated proxy already validates/caches bytes; use its absolute URL on every platform. */
export const artistPhotoImageProps = (photo: ArtistPhotoResult) => ({
  src: photo.url,
  // Next otherwise treats even absolute same-origin URLs as remote optimizer inputs.
  unoptimized: photo.provider === 'curated_web',
});
