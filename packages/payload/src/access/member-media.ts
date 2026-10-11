import { APIError, type Access, type CollectionBeforeOperationHook, type CollectionBeforeValidateHook, type PayloadRequest } from 'payload';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';

const RASTER_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const collectionOf = (user: unknown) => user && typeof user === 'object' && 'collection' in user ? user.collection : undefined;
const rasterMime = (mime: unknown) => typeof mime === 'string' && RASTER_AVATAR_TYPES.has(mime.split(';')[0]!.trim().toLowerCase());

/** Curators retain editorial uploads; members may only submit avatar files. */
async function isRasterFile(file: PayloadRequest['file']): Promise<boolean> {
  if (!file || file.size <= 0) return false;
  try {
    // Positive byte identity is required. Payload's MIME fallback plus its
    // dimension probe alone can accept malformed text containing an SVG tag.
    const detected = file.tempFilePath
      ? await fileTypeFromFile(file.tempFilePath)
      : await fileTypeFromBuffer(file.data);
    return rasterMime(detected?.mime);
  } catch {
    return false;
  }
}

export const memberMediaCreate: Access = async ({ req: { user, file } }) => {
  if (collectionOf(user) === 'users') return true;
  return collectionOf(user) === 'members' && await isRasterFile(file);
};

/** Payload regenerates these from the file; submitted dimensions cannot certify it. */
export const stripMemberMediaMetadata: CollectionBeforeOperationHook<'media'> = ({ args, operation, req }) => {
  if (operation === 'create' && collectionOf(req.user) === 'members' && 'data' in args && args.data) {
    // Members author avatars, not editorial provenance or storage destinations.
    // Payload adds the file identity and measurements after this hook.
    return { ...args, data: { alt: args.data.alt } };
  }
  return args;
};

/** Runs after Payload byte detection and its image-dimension probe, before storage. */
export const validateMemberMedia: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || collectionOf(req.user) !== 'members') return data;
  if (!await isRasterFile(req.file) || !rasterMime(data?.mimeType)
    || !Number.isFinite(data?.width) || Number(data?.width) <= 0
    || !Number.isFinite(data?.height) || Number(data?.height) <= 0) {
    throw new APIError('Choose a valid JPEG, PNG, WebP, GIF, or AVIF photo for your avatar. SVG and other document uploads are not supported.', 400);
  }
  return data;
};
