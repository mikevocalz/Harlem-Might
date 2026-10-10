import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getPayload } from 'payload';
import config from './payload.config';
import type { Media } from './payload-types';

// Rights-cleared Harlem photography into the media collection. Only rows with
// an explicit open rights statement are taken:
//   - Library of Congress photos: keep only "No known restrictions"/
//     "no known copyright restriction"/"public domain" rights_advisory rows.
//   - Wikimedia Commons: keep only Public domain, CC0, CC BY, CC BY-SA.
// The original file is downloaded and stored; source/license/creator/credit
// are recorded on the record — the editorial gate elsewhere still decides
// whether an image may render.
//
// `pnpm seed:media` previews; `--apply` downloads and inserts new sourceUrls.

const LOC_QUERIES = ['harlem', 'harlem+renaissance', 'apollo+theater+harlem', '125th+street+harlem'];
const COMMONS_QUERIES = [
  'Harlem',
  'Apollo Theater',
  'Harlem Renaissance',
  '125th Street Manhattan',
  'Marcus Garvey Park',
  'Studio Museum in Harlem',
  'Schomburg Center',
  "Strivers' Row",
  'Abyssinian Baptist Church',
  'Hotel Theresa',
  'Riverside Church',
  'Cathedral of Saint John the Divine',
  'Hamilton Grange',
  'Sylvia’s Restaurant',
  'Minton’s Playhouse',
];
const LOC_PER_QUERY = 8;
const COMMONS_PER_QUERY = 6;
const MEDIA_LIMIT = 100;

type MediaData = Pick<Media, 'alt' | 'ingestedAt'> &
  Partial<Pick<Media, 'role' | 'source' | 'sourceUrl' | 'license' | 'licenseUrl' | 'creator' | 'credit' | 'attributionText' | 'capturedAt' | 'shareAlike' | 'noDerivatives'>>;

type Candidate = { data: MediaData; imageUrl: string; filename: string };

type LocRow = {
  id?: string;
  title?: string;
  url?: string;
  date?: string;
  contributor?: string[];
  image_url?: string[];
  subject?: string[];
  location_city?: string[];
  location_state?: string[];
  item?: { rights_advisory?: string; place?: { title?: string }[] };
};

const FREE_RIGHTS = /no known (copyright )?restrictions?|public domain/i;

/** LOC keyword search returns Harlem, Montana and lookalikes; require a Harlem
 *  signal AND a New York signal in the record's descriptive fields. */
function isHarlemNyc(row: LocRow): boolean {
  const haystack = JSON.stringify([row.title, row.subject, row.location_city, row.location_state, row.item?.place]).toLowerCase();
  return /harlem/.test(haystack) && /new york|n\.?y\.?\b|manhattan|harlem river/.test(haystack);
}

const COMMONS_OK_LICENSES = /^(public domain|cc0|cc by( |$)|cc by-sa|cc-by|cc-by-sa)/i;

// Commons search is looser than LOC: a "125th Street" query matched files
// named for other cities' streets. Require a Harlem/Manhattan signal in the
// title or categories and reject obvious out-of-town names.
const HARLEM_SIGNAL = /harlem|apollo theater|125th street|125th st|marcus garvey|sugar hill|morningside|strivers|studio museum|schomburg|abyssinian|theresa|riverside church|st john the divine|hamilton grange|hamilton heights|east harlem|minton|sylvia/i;
const NOT_HARLEM = /covington|kentucky|montana|siegen|düsseldorf|dusseldorf|emden|germany|washington state|illinois|ohio|georgia|alabama/i;

/** Wikimedia asks clients to send a descriptive User-Agent. */
const COMMONS_HEADERS = { 'User-Agent': process.env.EVENTS_SCRAPER_USER_AGENT ?? 'HarlemMightBot/1.0' };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000), ...init });
  if (!response.ok) throw new Error(`Source request failed (${response.status}): ${new URL(url).host}`);
  return (await response.json()) as T;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, n) => ({ amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' })[n as 'amp' | 'apos' | 'gt' | 'lt' | 'nbsp' | 'quot'] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

async function locCandidates(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const q of LOC_QUERIES) {
    const rows = await fetchJson<{ results?: LocRow[] }>(
      `https://www.loc.gov/photos/?${new URLSearchParams({ q, fo: 'json', c: '50', sp: '1' })}`,
    );
    let taken = 0;
    for (const row of rows.results ?? []) {
      if (taken >= LOC_PER_QUERY) break;
      const advisory = `${row.item?.rights_advisory ?? ''}`.trim();
      const imageUrl = row.image_url?.at(-1);
      if (!row.id || !row.title || !row.url || !imageUrl || !FREE_RIGHTS.test(advisory) || !isHarlemNyc(row)) continue;
      out.push({
        imageUrl: imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl,
        filename: `loc-${row.id.replace(/\D+/g, '')}.jpg`,
        data: {
          alt: row.title.trim(),
          source: 'loc',
          sourceUrl: row.url,
          license: advisory,
          creator: row.contributor?.[0],
          credit: `Library of Congress, Prints & Photographs Division${row.contributor?.[0] ? `, ${row.contributor[0]}` : ''}`,
          attributionText: `Library of Congress${row.contributor?.[0] ? ` / ${row.contributor[0]}` : ''}`,
          capturedAt: row.date?.trim(),
          role: 'historical',
          ingestedAt: new Date().toISOString(),
        },
      });
      taken++;
    }
  }
  return out;
}

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: {
    url?: string;
    thumburl?: string;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: {
      LicenseShortName?: { value?: string };
      LicenseUrl?: { value?: string };
      Artist?: { value?: string };
      Credit?: { value?: string };
      ImageDescription?: { value?: string };
      DateTime?: { value?: string };
      Attribution?: { value?: string };
      Categories?: { value?: string };
    };
  }[];
};

async function commonsCandidates(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const q of COMMONS_QUERIES) {
    const result = await fetchJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
      `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
        origin: '*',
        action: 'query',
        generator: 'search',
        gsrsearch: q,
        gsrnamespace: '6',
        gsrlimit: '20',
        prop: 'imageinfo',
        iiprop: 'url|mime|extmetadata',
        iiurlwidth: '1600',
        format: 'json',
      })}`,
      { headers: COMMONS_HEADERS },
    );
    let taken = 0;
    for (const page of Object.values(result.query?.pages ?? {})) {
      if (taken >= COMMONS_PER_QUERY) break;
      const info = page.imageinfo?.[0];
      const license = info?.extmetadata?.LicenseShortName?.value ?? '';
      const url = info?.thumburl ?? info?.url;
      if (!info || !url || !info.mime?.startsWith('image/') || !COMMONS_OK_LICENSES.test(license)) continue;
      if (!/jpe?g|png|webp/.test(info.mime)) continue;
      const artist = stripHtml(info.extmetadata?.Artist?.value ?? '');
      const title = stripHtml(page.title ?? 'Untitled').replace(/^File:/, '').replace(/\.(jpe?g|png|webp)$/i, '');
      const categories = info.extmetadata?.Categories?.value ?? '';
      const signal = `${title} ${categories}`;
      if (!HARLEM_SIGNAL.test(signal) || NOT_HARLEM.test(signal)) continue;
      out.push({
        imageUrl: url,
        filename: `commons-${page.pageid}.${info.mime === 'image/png' ? 'png' : info.mime === 'image/webp' ? 'webp' : 'jpg'}`,
        data: {
          alt: title,
          source: 'wikimedia_commons',
          sourceUrl: info.descriptionurl,
          license,
          licenseUrl: info.extmetadata?.LicenseUrl?.value,
          creator: artist || undefined,
          credit: stripHtml(info.extmetadata?.Credit?.value ?? '') || 'Wikimedia Commons',
          attributionText: stripHtml(info.extmetadata?.Attribution?.value ?? '') || `${title}, ${license}, via Wikimedia Commons`,
          capturedAt: stripHtml(info.extmetadata?.DateTime?.value ?? '') || undefined,
          shareAlike: /by-sa/i.test(license),
          role: 'gallery',
          ingestedAt: new Date().toISOString(),
        },
      });
      taken++;
    }
  }
  return out;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to import media.');
const apply = process.argv.includes('--apply');
const candidates = [...(await locCandidates()), ...(await commonsCandidates())].slice(0, MEDIA_LIMIT);

const payload = await getPayload({ config });
const existingSources = new Set<string>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'media', limit: 100, page, depth: 0, overrideAccess: true });
  result.docs.forEach((doc) => doc.sourceUrl && existingSources.add(doc.sourceUrl));
  if (!result.hasNextPage) break;
}
const missing = candidates.filter((c) => c.data.sourceUrl && !existingSources.has(c.data.sourceUrl));

console.info(
  `Candidates ${candidates.length} (LOC + Wikimedia Commons, rights-cleared only); existing ${candidates.length - missing.length}; new ${missing.length}.`,
);
if (!apply) {
  console.info(
    `Preview only; pass --apply to download and insert. Sample: ${missing
      .slice(0, 12)
      .map((c) => `${c.data.alt} [${c.data.license}]`)
      .join('; ')}`,
  );
} else {
  const dir = await mkdtemp(path.join(tmpdir(), 'harlem-might-media-'));
  try {
    for (const candidate of missing) {
      const response = await fetch(candidate.imageUrl, { signal: AbortSignal.timeout(120_000), headers: COMMONS_HEADERS });
      if (!response.ok) {
        console.warn(`Skipping ${candidate.data.sourceUrl}: download failed (${response.status}).`);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const filePath = path.join(dir, candidate.filename);
      await writeFile(filePath, bytes);
      await payload.create({ collection: 'media', overrideAccess: true, data: candidate.data, filePath });
      console.info(`Created media ${candidate.data.alt}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  console.info(`Created ${missing.length} media records with source, license and credit.`);
}
