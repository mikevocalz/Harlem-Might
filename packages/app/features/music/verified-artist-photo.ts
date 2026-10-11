import { isFreeArtistPhotoLicense, isCommonsArtistPhotoUrl } from './artist-photo-rights.ts';
import type { ArtistPhotoResult } from './artist-photo.ts';
import {
  CURATED_COMMONS_FILES,
  CURATED_DIRECT_PHOTOS,
  CURATED_PROFILE_PAGES,
  VERIFIED_MISSING_ARTIST_NAMES,
  VERIFIED_WIKIPEDIA_TITLES,
  type CuratedArtistProfile,
} from './verified-artist-photo-data.ts';

export { VERIFIED_MISSING_ARTIST_NAMES };

export type VerifiedArtistPhotoResponse = {
  ok: boolean;
  url?: string;
  json(): Promise<unknown>;
  text?(): Promise<string>;
};

export type VerifiedArtistPhotoFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<VerifiedArtistPhotoResponse>;

type CommonsPage = {
  title?: string;
  imageinfo?: {
    url?: string;
    width?: number;
    height?: number;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
};

type WikipediaPage = {
  title?: string;
  original?: { source?: string };
  terms?: { description?: string[] };
};

const BAD_COMMONS_TOKENS =
  /\b(logo|signature|sig|album|cover|vinyl|record|poster|ticket|plaque|discography|award|building|recreation center|statue|star)\b/i;
const BAD_PROFILE_IMAGE_TOKENS =
  /(?:logo|favicon|sprite|placeholder|default-avatar|default_image|brandmark|site-icon)/i;

export const normalizeVerifiedArtistName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$/g, 's')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const hasVerifiedArtistPhotoSource = (name: string): boolean => {
  const key = normalizeVerifiedArtistName(name);
  return [VERIFIED_WIKIPEDIA_TITLES, CURATED_COMMONS_FILES, CURATED_PROFILE_PAGES, CURATED_DIRECT_PHOTOS]
    .some((sources) => Object.hasOwn(sources, key));
};

const stripHtml = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || undefined;
};

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const absoluteUrl = (value: string | undefined, base: string): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
};

const commonsSourceUrl = (title: string): string =>
  `https://commons.wikimedia.org/wiki/${encodeURIComponent(
    title.replace(/ /g, '_'),
  ).replace(/%3A/i, ':')}`;

const commonsPhoto = (
  name: string,
  page: CommonsPage,
): ArtistPhotoResult | undefined => {
  const title = page.title?.replace(/^File:/i, '') ?? '';
  const info = page.imageinfo?.[0];
  if (
    !title ||
    BAD_COMMONS_TOKENS.test(title) ||
    !info?.url ||
    !isCommonsArtistPhotoUrl(info.url) ||
    !/^image\/(jpeg|png|webp)$/i.test(info.mime ?? '')
  ) {
    return undefined;
  }

  const meta = info.extmetadata ?? {};
  const sourceUrl = commonsSourceUrl(page.title ?? `File:${title}`);
  const creator =
    stripHtml(meta.Artist?.value) ??
    stripHtml(meta.Credit?.value) ??
    'Wikimedia Commons contributor';
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!isFreeArtistPhotoLicense(license)) return undefined;
  if (/^cc[ -]by/i.test(license ?? '') && !stripHtml(meta.Artist?.value) && !stripHtml(meta.Credit?.value)) {
    return undefined;
  }
  const licenseUrl =
    absoluteUrl(stripHtml(meta.LicenseUrl?.value), 'https://commons.wikimedia.org') ??
    sourceUrl;

  return {
    name,
    url: info.url,
    sourceUrl,
    provider: 'wikimedia_commons',
    rightsStatus: 'rights-cleared',
    credit: creator,
    license,
    licenseUrl,
    width: info.width,
    height: info.height,
  };
};

async function resolveCommonsFileByTitle(
  name: string,
  title: string,
  fetcher: VerifiedArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    titles: title.startsWith('File:') ? title : `File:${title}`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
  });
  const response = await fetcher(
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) return undefined;

  const root = asObject(await response.json());
  const query = asObject(root?.query);
  const pagesObject = asObject(query?.pages);
  if (!pagesObject) return undefined;

  const page = Object.values(pagesObject)
    .map((value) => asObject(value) as CommonsPage | undefined)
    .find((value): value is CommonsPage => Boolean(value?.imageinfo?.[0]?.url &&
        value.title?.replace(/_/g, ' ').normalize('NFC').toLowerCase() ===
          title.replace(/_/g, ' ').normalize('NFC').toLowerCase()));
  return page ? commonsPhoto(name, page) : undefined;
}

async function resolveCommonsFileByUrl(
  name: string,
  sourceUrl: string,
  fetcher: VerifiedArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return undefined;
  }
  if (
    url.hostname !== 'upload.wikimedia.org' ||
    !url.pathname.includes('/wikipedia/commons/')
  ) {
    return undefined;
  }
  const basename = url.pathname.split('/').pop();
  if (!basename) return undefined;
  const filename = decodeURIComponent(basename).replace(/_/g, ' ');
  return resolveCommonsFileByTitle(name, `File:${filename}`, fetcher);
}

async function resolveVerifiedWikipedia(
  name: string,
  expectedTitle: string,
  fetcher: VerifiedArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    titles: expectedTitle,
    redirects: '1',
    prop: 'pageimages|pageterms',
    piprop: 'original',
    wbptterms: 'description',
  });
  const response = await fetcher(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) return undefined;

  const root = asObject(await response.json());
  const query = asObject(root?.query);
  const pagesObject = asObject(query?.pages);
  if (!pagesObject) return undefined;

  const page = Object.values(pagesObject)
    .map((value) => asObject(value) as WikipediaPage | undefined)
    .find(
      (value): value is WikipediaPage =>
        Boolean(
          value?.title &&
            value.original?.source &&
            !/disambiguation/i.test(value.terms?.description?.join(' ') ?? '') &&
            normalizeVerifiedArtistName(value.title) ===
              normalizeVerifiedArtistName(expectedTitle),
        ),
    );
  if (!page?.original?.source) return undefined;
  return resolveCommonsFileByUrl(name, page.original.source, fetcher);
}

const decodeHtmlAttribute = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x2F;/gi, '/');

/** Read quoted attributes only from a complete tag, never across nested markup. */
const htmlAttribute = (tag: string, name: string): string | undefined => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? decodeHtmlAttribute(match[1] ?? match[2] ?? '') : undefined;
};

const metaContent = (html: string, key: string): string | undefined => {
  for (const tag of html.match(/<meta\b[^<>]*>/gi) ?? []) {
    const name = htmlAttribute(tag, 'property') ?? htmlAttribute(tag, 'name');
    if (name?.toLowerCase() === key) return htmlAttribute(tag, 'content');
  }
  return undefined;
};

const artistImgSrc = (html: string, name: string): string | undefined => {
  const wanted = normalizeVerifiedArtistName(name);
  for (const tag of html.match(/<img\b[^<>]*>/gi) ?? []) {
    const alt = htmlAttribute(tag, 'alt') ?? htmlAttribute(tag, 'title');
    const srcset = htmlAttribute(tag, 'srcset') ?? htmlAttribute(tag, 'data-srcset');
    const src = htmlAttribute(tag, 'src') ?? htmlAttribute(tag, 'data-src') ??
      srcset?.split(',')[0]?.trim().split(/\s+/)[0];
    if (
      alt &&
      src &&
      normalizeVerifiedArtistName(decodeHtmlAttribute(alt))
        .replace(/^(?:photo|portrait|image|headshot|avatar) (?:of|for) /, '')
        .replace(/ (?:photo|portrait|image)$/, '') === wanted
    ) {
      return decodeHtmlAttribute(src);
    }
  }
  return undefined;
};

async function resolveCuratedProfile(
  name: string,
  profile: CuratedArtistProfile,
  fetcher: VerifiedArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const response = await fetcher(profile.url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'HarlemMight/1.0 (+https://harlemmight.com)',
    },
  });
  if (!response.ok || !response.text) return undefined;

  // A retired profile redirecting to a homepage must never change artist identity.
  const base = response.url || profile.url;
  if (new URL(base).href !== new URL(profile.url).href) return undefined;
  const html = await response.text();
  const pageTitle = metaContent(html, 'og:title') ?? metaContent(html, 'twitter:title') ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const normalizedTitle = normalizeVerifiedArtistName(decodeHtmlAttribute(pageTitle ?? ''));
  const wanted = normalizeVerifiedArtistName(name);
  const titleSubject = normalizeVerifiedArtistName(decodeHtmlAttribute(pageTitle ?? '').split(/\s+[-–—|]\s+/)[0] ?? '');
  const namesArtist = normalizedTitle === wanted || titleSubject === wanted ||
    Boolean(profile.reviewedPageTitles?.some((title) => normalizeVerifiedArtistName(title) === normalizedTitle)) ||
    normalizedTitle.startsWith(`${wanted} music `) ||
    normalizedTitle.startsWith(`${wanted} official `) ||
    normalizedTitle.startsWith(`${wanted} last fm`) ||
    normalizedTitle.startsWith(`${wanted} biography`);
  const candidate =
    artistImgSrc(html, name) ??
    (namesArtist ? (metaContent(html, 'og:image') ??
      metaContent(html, 'twitter:image') ??
      metaContent(html, 'twitter:image:src')) : undefined);
  const imageUrl = absoluteUrl(candidate, base);
  if (!imageUrl) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' || BAD_PROFILE_IMAGE_TOKENS.test(imageUrl)) {
    return undefined;
  }

  return {
    name,
    url: imageUrl,
    sourceUrl: profile.url,
    provider: 'curated_web',
    rightsStatus: 'provider-reference',
    credit: profile.credit,
  };
}

export async function resolveVerifiedArtistPhoto(
  name: string,
  fetcher: VerifiedArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) return undefined;
  const key = normalizeVerifiedArtistName(trimmed);
  if (!hasVerifiedArtistPhotoSource(trimmed)) return undefined;

  const direct = CURATED_DIRECT_PHOTOS[key];
  if (direct) {
    return {
      name: trimmed,
      url: direct.url,
      sourceUrl: direct.sourceUrl,
      provider: 'curated_web',
      rightsStatus: 'provider-reference',
      credit: direct.credit,
    };
  }

  const commonsFile = CURATED_COMMONS_FILES[key];
  if (commonsFile) {
    return resolveCommonsFileByTitle(trimmed, commonsFile, fetcher);
  }

  const wikipediaTitle = VERIFIED_WIKIPEDIA_TITLES[key];
  if (wikipediaTitle) {
    return resolveVerifiedWikipedia(trimmed, wikipediaTitle, fetcher);
  }

  const profile = CURATED_PROFILE_PAGES[key];
  if (profile) {
    return resolveCuratedProfile(trimmed, profile, fetcher);
  }

  return undefined;
}

export async function resolveVerifiedArtistPhotos(
  names: readonly string[],
  fetcher: VerifiedArtistPhotoFetch,
  concurrency = 10,
): Promise<Record<string, ArtistPhotoResult | null>> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const output: Record<string, ArtistPhotoResult | null> = {};
  let cursor = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, 12)) },
    async () => {
      while (cursor < unique.length) {
        const index = cursor++;
        const name = unique[index];
        if (!name) continue;
        try {
          output[name] = (await resolveVerifiedArtistPhoto(name, fetcher)) ?? null;
        } catch {
          output[name] = null;
        }
      }
    },
  );
  await Promise.all(workers);
  return output;
}
