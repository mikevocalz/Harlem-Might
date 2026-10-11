export type ArtistPhotoProvider =
  | 'wikimedia_commons'
  | 'deezer'
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

type DeezerArtist = {
  id?: number;
  name?: string;
  link?: string;
  picture_xl?: string;
  picture_big?: string;
  picture_medium?: string;
};

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    width?: number;
    height?: number;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
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
  /\b(rapper|singer|musician|composer|band|choir|quartet|pianist|saxophonist|trumpeter|drummer|vocalist|songwriter|record producer|disc jockey|dj|jazz|salsa|reggaeton|hip[- ]?hop|r&b|soul|funk|gospel|blues|violinist|entertainer|recording artist)\b/i;
const BAD_COMMONS_TOKENS =
  /\b(logo|signature|sig|album|cover|vinyl|record|poster|ticket|plaque|discography|award)\b/i;

export const normalizeArtistName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$/g, 's')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const AMBIGUOUS_DEEZER_NAMES = new Set(['t rex', 'bloodshed']);

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

const scoreCommonsPage = (artistName: string, page: CommonsPage): number => {
  const title = page.title?.replace(/^File:/i, '') ?? '';
  if (!title || BAD_COMMONS_TOKENS.test(title)) return -1000;
  const info = page.imageinfo?.[0];
  if (!info?.url || !/^image\/(jpeg|png|webp)$/i.test(info.mime ?? '')) {
    return -1000;
  }

  const artist = normalizeArtistName(artistName);
  const file = normalizeArtistName(title);
  const metadata = normalizeArtistName(
    [
      info.extmetadata?.Description?.value,
      info.extmetadata?.ObjectName?.value,
      info.extmetadata?.ImageDescription?.value,
      info.extmetadata?.Categories?.value,
    ]
      .filter(Boolean)
      .join(' '),
  );
  const subjectText = `${file} ${metadata}`;
  const words = artist.split(' ').filter((word) => word.length > 1);
  const matchedWords = words.filter((word) => subjectText.includes(word));
  if (matchedWords.length === 0) return -1000;

  let score = matchedWords.length * 12;
  if (subjectText.includes(artist)) score += 40;
  if (/\b(crop|cropped|portrait|headshot)\b/i.test(title)) score += 20;
  if (info.width && info.height && info.height >= info.width) score += 8;
  return score;
};

const commonsPhoto = (
  name: string,
  page: CommonsPage,
): ArtistPhotoResult | undefined => {
  const info = page.imageinfo?.[0];
  if (!page.title || !info?.url) return undefined;
  const meta = info.extmetadata ?? {};
  const sourceUrl = commonsSourceUrl(page.title);
  const creator =
    stripHtml(meta.Artist?.value) ??
    stripHtml(meta.Credit?.value) ??
    'Wikimedia Commons contributor';
  const license =
    stripHtml(meta.LicenseShortName?.value) ?? 'Wikimedia Commons free media';
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

async function resolveCommons(
  name: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: name,
    gsrlimit: '16',
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

  const pages = Object.values(pagesObject)
    .map((page) => asObject(page) as CommonsPage | undefined)
    .filter((page): page is CommonsPage => Boolean(page))
    .sort(
      (a, b) => scoreCommonsPage(name, b) - scoreCommonsPage(name, a),
    );

  const best = pages[0];
  return best && scoreCommonsPage(name, best) > 0
    ? commonsPhoto(name, best)
    : undefined;
}

const scoreWikipediaPage = (
  artistName: string,
  page: WikipediaPage,
): number => {
  if (!page.title || !page.original?.source) return -1000;
  const wanted = normalizeArtistName(artistName);
  const title = normalizeArtistName(page.title);
  const description = page.terms?.description?.join(' ') ?? '';
  let score = 0;

  if (title === wanted) score += 70;
  if (title.includes(wanted) || wanted.includes(title)) score += 25;
  if (MUSIC_HINTS.test(description)) score += 35;
  if (/disambiguation/i.test(description)) score -= 100;
  if (/album|song|film|book|painting|fictional/i.test(description)) score -= 50;

  return score;
};

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
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    titles: `File:${filename}`,
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

async function resolveWikipedia(
  name: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${name} musician`,
    gsrlimit: '8',
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
    .filter((page): page is WikipediaPage => Boolean(page))
    .sort(
      (a, b) => scoreWikipediaPage(name, b) - scoreWikipediaPage(name, a),
    );

  const best = pages[0];
  if (!best || scoreWikipediaPage(name, best) < 60 || !best.original?.source) {
    return undefined;
  }

  return resolveCommonsFileByUrl(name, best.original.source, fetcher);
}

const deezerExactMatch = (
  name: string,
  artists: DeezerArtist[],
): DeezerArtist | undefined => {
  const wanted = normalizeArtistName(name);
  return artists.find(
    (artist) => normalizeArtistName(artist.name ?? '') === wanted,
  );
};

async function resolveDeezer(
  name: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  if (AMBIGUOUS_DEEZER_NAMES.has(normalizeArtistName(name))) return undefined;

  const params = new URLSearchParams({ q: name, limit: '10' });
  const response = await fetcher(
    `https://api.deezer.com/search/artist?${params.toString()}`,
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) return undefined;
  const root = asObject(await response.json());
  const data = Array.isArray(root?.data) ? root.data : [];
  const artists = data
    .map((artist) => asObject(artist) as DeezerArtist | undefined)
    .filter((artist): artist is DeezerArtist => Boolean(artist));
  const match = deezerExactMatch(name, artists);
  const url = match?.picture_xl ?? match?.picture_big ?? match?.picture_medium;
  if (!match || !url) return undefined;

  return {
    name,
    url,
    sourceUrl:
      match.link ?? `https://www.deezer.com/search/${encodeURIComponent(name)}`,
    provider: 'deezer',
    rightsStatus: 'provider-reference',
    credit: 'Deezer artist profile',
  };
}

/**
 * Resolve a real artist photo. Performance thumbnails, album art and generic
 * Harlem imagery are intentionally excluded from this path.
 */
export async function resolveArtistPhoto(
  name: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) return undefined;

  const key = normalizeArtistName(trimmed);
  const curated = CURATED_WEB_PHOTOS[key];
  if (curated) return { ...curated, name: trimmed };

  const deezer = await resolveDeezer(trimmed, fetcher);
  if (deezer) return deezer;

  const wikipedia = await resolveWikipedia(trimmed, fetcher);
  if (wikipedia) return wikipedia;

  return resolveCommons(trimmed, fetcher);
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
      (provider === 'wikimedia_commons' ||
        provider === 'deezer' ||
        provider === 'curated_web'),
  );
};


export const artistPhotoProviderLabel = (
  provider: ArtistPhotoProvider,
): string => {
  switch (provider) {
    case 'wikimedia_commons':
      return 'Wikimedia Commons';
    case 'deezer':
      return 'Deezer';
    case 'curated_web':
      return 'Verified artist source';
  }
};
