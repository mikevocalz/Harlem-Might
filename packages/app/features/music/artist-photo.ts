import { isFreeArtistPhotoLicense, isCommonsArtistPhotoUrl } from './artist-photo-rights.ts';
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

type JsonResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type ArtistPhotoFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<JsonResponse>;

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
  pageid?: number;
  title?: string;
  original?: {
    source?: string;
    width?: number;
    height?: number;
  };
  terms?: {
    description?: string[];
  };
};

const MUSIC_HINTS =
  /\b(rapper|singer|musician|composer|band|choir|quartet|pianist|saxophonist|trumpeter|drummer|vocalist|songwriter|record producer|disc jockey|dj|jazz|salsa|reggaeton|hip[- ]?hop|r&b|soul|funk|gospel|blues|violinist|entertainer|recording artist|musical group)\b/i;

const BAD_COMMONS_TOKENS =
  /\b(logo|signature|sig|album|cover|vinyl|record|poster|ticket|plaque|discography|award|building|recreation center|statue|star)\b/i;

const MUSIC_TITLE_DISAMBIGUATOR =
  /\s*\((?:rapper|singer|musician|band|group|choir|quartet|composer|pianist|saxophonist|trumpeter|drummer|vocalist|songwriter|record producer|dj|entertainer)\)\s*$/i;

export const normalizeArtistName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$/g, 's')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const CURATED_WEB_PHOTOS: Readonly<Record<string, ArtistPhotoResult>> = {
  't rex': {
    name: 'T-Rex',
    url: 'https://battlerapstats.wordpress.com/wp-content/uploads/2012/04/dhfzg.png?h=300&w=210',
    sourceUrl: 'https://battlerapstats.wordpress.com/2012/04/24/harlem-bettle-rapper-t-rex/',
    provider: 'curated_web',
    rightsStatus: 'provider-reference',
    credit: 'BattleRapStats artist profile',
    width: 210,
    height: 300,
  },
  bloodshed: {
    name: 'Bloodshed',
    url: 'https://townsquare.media/site/812/files/2015/03/bloodshed.jpg?q=75&w=980',
    sourceUrl: 'https://www.xxlmag.com/today-hip-hop-rip-bloodshed-july-31-1975-march-2-1997/',
    provider: 'curated_web',
    rightsStatus: 'provider-reference',
    credit: 'XXL artist memorial',
  },
};

/**
 * Exact Commons files that were manually verified against the intended artist.
 * These exist specifically for cases where a fuzzy name search previously
 * selected the wrong person or object.
 */
const CURATED_COMMONS_FILES: Readonly<Record<string, string>> = {
  'charles hamilton': 'File:Charles Hamilton (rapper).jpg',
  'frankie lymon and the teenagers':
    'File:Frankie Lymon and the Teenagers.jpg',
};

/**
 * Stage-name aliases where the encyclopedia article uses a different title.
 * Identity still has to carry a music description before its image is used.
 */
const WIKIPEDIA_TITLE_ALIASES: Readonly<Record<string, string>> = {
  diddy: 'Sean Combs',
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

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const absoluteUrl = (
  value: string | undefined,
  base: string,
): string | undefined => {
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
    absoluteUrl(
      stripHtml(meta.LicenseUrl?.value),
      'https://commons.wikimedia.org',
    ) ?? sourceUrl;

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
  fetcher: ArtistPhotoFetch,
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
    .find((value): value is CommonsPage => Boolean(value?.imageinfo?.[0]?.url));

  return page ? commonsPhoto(name, page) : undefined;
}

async function resolveCommonsFileByUrl(
  name: string,
  source: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  let url: URL;
  try {
    url = new URL(source);
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

const wikipediaIdentityMatches = (
  artistName: string,
  page: WikipediaPage,
): boolean => {
  if (!page.title || !page.original?.source) return false;
  const description = page.terms?.description?.join(' ') ?? '';
  if (!MUSIC_HINTS.test(description) || /disambiguation/i.test(description)) {
    return false;
  }
  if (/\b(album|song|film|book|painting|fictional)\b/i.test(description)) {
    return false;
  }

  const wanted = normalizeArtistName(artistName);
  const title = normalizeArtistName(
    page.title.replace(MUSIC_TITLE_DISAMBIGUATOR, ''),
  );
  return title === wanted;
};

async function resolveWikipedia(
  name: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const aliasTitle = WIKIPEDIA_TITLE_ALIASES[normalizeArtistName(name)];
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    ...(aliasTitle
      ? { titles: aliasTitle, redirects: '1' }
      : {
          generator: 'search',
          gsrsearch: `"${name}" musician`,
          gsrlimit: '8',
        }),
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

  const pages = Object.values(pagesObject)
    .map((page) => asObject(page) as WikipediaPage | undefined)
    .filter((page): page is WikipediaPage => Boolean(page));

  const best = pages.find((page) =>
    aliasTitle
      ? MUSIC_HINTS.test(page.terms?.description?.join(' ') ?? '') &&
        Boolean(page.original?.source)
      : wikipediaIdentityMatches(name, page),
  );
  if (!best?.original?.source) return undefined;

  return resolveCommonsFileByUrl(name, best.original.source, fetcher);
};

/**
 * Resolve a real artist photo only when identity can be proved.
 *
 * No raw Commons name search and no same-name streaming-service fallback are
 * allowed: both previously produced false positives for ambiguous artist
 * names. If an entity-aware Wikipedia match or a manually verified source does
 * not exist, callers receive no photo rather than a guess.
 */
export async function resolveArtistPhoto(
  name: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) return undefined;

  const key = normalizeArtistName(trimmed);
  const curatedWeb = CURATED_WEB_PHOTOS[key];
  if (curatedWeb) return { ...curatedWeb, name: trimmed };

  const curatedCommonsFile = CURATED_COMMONS_FILES[key];
  if (curatedCommonsFile) {
    return resolveCommonsFileByTitle(trimmed, curatedCommonsFile, fetcher);
  }

  return resolveWikipedia(trimmed, fetcher);
}

/** Resolve many artists with a small worker pool instead of 100+ simultaneous calls. */
export async function resolveArtistPhotos(
  names: readonly string[],
  fetcher: ArtistPhotoFetch,
  concurrency = 12,
): Promise<Record<string, ArtistPhotoResult | null>> {
  const unique = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ].slice(0, 120);
  const output: Record<string, ArtistPhotoResult | null> = {};
  let cursor = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, 16)) },
    async () => {
      while (cursor < unique.length) {
        const index = cursor++;
        const name = unique[index];
        if (!name) continue;
        try {
          output[name] = (await resolveArtistPhoto(name, fetcher)) ?? null;
        } catch {
          output[name] = null;
        }
      }
    },
  );
  await Promise.all(workers);
  return output;
}

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
