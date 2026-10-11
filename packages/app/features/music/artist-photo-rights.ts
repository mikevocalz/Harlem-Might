/** Only explicit compatible licences can authorize durable artist-photo storage. */
export function isFreeArtistPhotoLicense(value: string | undefined): boolean {
  const license = value?.trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
  return Boolean(license && /^(?:public domain|cc0(?: 1\.0)?|cc by(?: sa)?(?: (?:[1-4]\.0|2\.5))?(?: [a-z]{2})?)$/i.test(license));
}

/** Commons image URLs must remain on its HTTPS upload host and media path. */
export function isCommonsArtistPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'upload.wikimedia.org' &&
      !url.username && !url.password && !url.port && url.pathname.startsWith('/wikipedia/commons/');
  } catch {
    return false;
  }
}
