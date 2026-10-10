import {
  HARLEM_ARCHIVAL_IMAGES,
  getHarlemArchivalImage,
  imageAspect,
  isDisplayableEditorialImage,
  type EditorialImage,
} from '@acme/assets';
import type { MediaDoc } from './docs.ts';

export { HARLEM_ARCHIVAL_IMAGES, getHarlemArchivalImage, isDisplayableEditorialImage };
export type { EditorialImage };

// Payload serves uploaded media at relative paths (/payload-api/media/file/…)
// while the displayable contract requires an absolute URL. Resolve against the
// origin that serves the API: the site origin on web, the configured API base
// on native. Literal env reads match mapboxToken.ts so bundlers inline them.
const resolveImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.EXPO_PUBLIC_PAYLOAD_API_BASE;
  if (!base || !url.startsWith('/')) return undefined;
  try {
    return new URL(url, base).href;
  } catch {
    return undefined;
  }
};

export const mapEditorialImages = (images: readonly (number | MediaDoc)[] | null | undefined): EditorialImage[] =>
  (images ?? []).flatMap((value) => {
    if (typeof value !== 'object') return [];
    const image: Partial<EditorialImage> = {
      id: value.id,
      role: value.role ?? undefined,
      url: resolveImageUrl(value.url),
      altText: value.alt,
      source: value.source ?? undefined,
      sourceUrl: value.sourceUrl ?? undefined,
      license: value.license ?? undefined,
      licenseUrl: value.licenseUrl ?? undefined,
      creator: value.creator ?? undefined,
      credit: value.credit ?? undefined,
      attributionText: value.attributionText ?? undefined,
      capturedAt: value.capturedAt ?? undefined,
      ingestedAt: value.ingestedAt ?? undefined,
      width: value.width ?? undefined,
      height: value.height ?? undefined,
      placeholderHash: value.placeholderHash ?? undefined,
      dominantColor: value.dominantColor ?? undefined,
      shareAlike: value.shareAlike ?? undefined,
      noDerivatives: value.noDerivatives ?? undefined,
    };
    if (!isDisplayableEditorialImage(image)) return [];
    return [{ ...image, aspect: imageAspect(image.width, image.height) }];
  });
