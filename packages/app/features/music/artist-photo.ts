export type ArtistPhotoProvider = 'wikimedia_commons' | 'deezer';

export type ArtistPhotoResult = {
  name: string;
  url: string;
  sourceUrl: string;
  provider: ArtistPhotoProvider;
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

const MUSIC_HINTS = /\b(rapper|singer|musician|composer|band|choir|quartet|pianist|saxophonist|trumpeter|drummer|vocalist|songwriter|record producer|dj|disc jockey|jazz|salsa|reggaeton|hip[- ]?hop|r&b|soul|funk|gospel|blues)\b/i;
const BAD_COMMONS_TOKENS = /\b(logo|signature|sig|album|cover|vinyl|record|poster|ticket|plaque|discography|award)\b/i;
const AMBIGUOUS_DEEZER_NAMES = new Set(['t rex', 'bloodshed']);

export const normalizeArtistName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$/g, 's')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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

const absoluteUrl = (value: string | undefined, base: string): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
};

const commonsSourceUrl = (title: string): string =>
  `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/i, ':')}`;

const scoreCommonsPage = (artistName: string, page: CommonsPage): number => {
  const title = page.title?.replace(/^File:/i, '') ?? '';
  if (!title || BAD_COMMONS_TOKENS.test(title)) return -1000;
  const info = page.imageinfo?.[0];
  if (!info?.url || !/^image\/(jpeg|png|webp)$/i.test(info.mime ?? '')) return -1000;

  const artist = normalizeArtistName(artistName);
  const file = normalizeArtistName(title);
  const words = artist.split(' ').filter((word) => word.length > 1);
  let score = words.reduce((sum, word) => sum + (file.includes(word) ? 12 : 0), 0);
  if (file.includes(artist)) score += 40;
  if (/\b(crop|cropped|portrait|headshot)\b/i.test(title)) score += 20;
  if (info.width && info.height && info.height >= info.width) score += 8;
  return score;
};

const commonsPhoto = (name: string, page: CommonsPage): ArtistPhotoResult | undefined => {
  const info = page.imageinfo?.[0];
  if (!page.title || !info?.url) return undefined;
  const meta = info.extmetadata ?? {};
  const sourceUrl = commonsSourceUrl(page.title);
  const creator =
    stripHtml(meta.Artist?.value) ??
    stripHtml(meta.Credit?.value) ??
    'Wikimedia Commons contributor';
  const license = stripHtml(meta.LicenseShortName?.value) ?? 'Wikimedia Commons free media';
  const licenseUrl =
    absoluteUrl(stripHtml(meta.LicenseUrl?.value), 'https://commons.wikimedia.org') ??
    sourceUrl;

  return {
    name,
    url: info.url,
    sourceUrl,
    provider: 'wikimedia_commons',
    credit: creator,
    license,
    licenseUrl,
    width: info.width,
    height: info.height,
  };
};

async function resolveCommons(name: string, fetcher: ArtistPhotoFetch): Promise<ArtistPhotoResult | undefined> {
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
  const response = await fetcher(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) return undefined;
  const root = asObject(await response.json());
  const query = asObject(root?.query);
  const pagesObject = asObject(query?.pages);
  if (!pagesObject) return undefined;

  const pages = Object.values(pagesObject)
    .map((page) => asObject(page) as CommonsPage | undefined)
    .filter((page): page is CommonsPage => Boolean(page))
    .sort((a, b) => scoreCommonsPage(name, b) - scoreCommonsPage(name, a));

  const best = pages[0];
  return best && scoreCommonsPage(name, best) > 0 ? commonsPhoto(name, best) : undefined;
}

const deezerExactMatch = (name: string, artists: DeezerArtist[]): DeezerArtist | undefined => {
  const wanted = normalizeArtistName(name);
  return artists.find((artist) => normalizeArtistName(artist.name ?? '') === wanted);
};

async function resolveDeezer(name: string, fetcher: ArtistPhotoFetch): Promise<ArtistPhotoResult | undefined> {
  if (AMBIGUOUS_DEEZER_NAMES.has(normalizeArtistName(name))) return undefined;

  const params = new URLSearchParams({ q: name, limit: '10' });
  const response = await fetcher(`https://api.deezer.com/search/artist?${params.toString()}`, {
    headers: { accept: 'application/json' },
  });
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
    sourceUrl: match.link ?? `https://www.deezer.com/search/${encodeURIComponent(name)}`,
    provider: 'deezer',
    credit: 'Deezer artist profile',
  };
}

/**
 * Resolve a real artist photo. Performance thumbnails and generic Harlem
 * imagery are intentionally excluded from this path.
 */
export async function resolveArtistPhoto(
  name: string,
  fetcher: ArtistPhotoFetch,
): Promise<ArtistPhotoResult | undefined> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) return undefined;

  // Deezer has broad coverage for contemporary artists and returns the actual
  // artist-profile image in one request. Names known to be ambiguous skip it.
  const deezer = await resolveDeezer(trimmed, fetcher);
  if (deezer) return deezer;

  // Commons is the rights-aware fallback for historic/ambiguous artists.
  return resolveCommons(trimmed, fetcher);
}

/** Resolve many artists with a small worker pool instead of 100+ simultaneous calls. */
export async function resolveArtistPhotos(
  names: readonly string[],
  fetcher: ArtistPhotoFetch,
  concurrency = 12,
): Promise<Record<string, ArtistPhotoResult | null>> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 120);
  const output: Record<string, ArtistPhotoResult | null> = {};
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, 16)) }, async () => {
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
  });
  await Promise.all(workers);
  return output;
}

export const isArtistPhotoResult = (value: unknown): value is ArtistPhotoResult => {
  const object = asObject(value);
  const provider = asString(object?.provider);
  return Boolean(
    asString(object?.name) &&
      asString(object?.url) &&
      asString(object?.sourceUrl) &&
      asString(object?.credit) &&
      (provider === 'wikimedia_commons' || provider === 'deezer'),
  );
};
