import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getPayload } from 'payload';
import config from './payload.config';

// Each story's own lead image: the infobox image of the Wikipedia article the
// story cites (a portrait for a person, the building for a place). Only
// Commons files under Public domain, CC0, CC BY or CC BY-SA are taken; the
// file is stored with source, license, creator and credit, then put first in
// the story's images. Stories that already lead with an image are skipped.
//
// `pnpm seed:story-images` previews; `--apply` downloads and attaches.

const OK_LICENSES = /^(public domain|pd|cc0|cc by( |-|$)|cc by-sa|cc-by|cc-by-sa)/i;
const HEADERS = { 'User-Agent': process.env.EVENTS_SCRAPER_USER_AGENT ?? 'HarlemMightBot/1.0' };
// Public-domain files carry no licence URL; the PD Mark is the standard statement.
const PD_MARK = 'https://creativecommons.org/publicdomain/mark/1.0/';

const strip = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    if (res.ok && text.startsWith('{')) return JSON.parse(text) as T;
    if (attempt === 3) throw new Error(`${new URL(url).host} answered ${res.status}`);
    await sleep(5_000 * (attempt + 1)); // Wikimedia rate limit
  }
}

type Info = {
  url?: string;
  thumburl?: string;
  mime?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
};

async function leadImage(articleUrl: string) {
  const title = decodeURIComponent(new URL(articleUrl).pathname.replace('/wiki/', ''));
  const page = await json<{ query: { pages: Record<string, { pageimage?: string }> } }>(
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'pageimages', piprop: 'name', redirects: '1', titles: title, format: 'json' })}`,
  );
  const file = Object.values(page.query.pages)[0]?.pageimage;
  if (!file) return { skip: 'article has no lead image' } as const;
  // A logo or wordmark is not a photograph of the subject.
  if (/logo|wordmark|seal|\.svg$/i.test(file)) return { skip: `${file} is a logo` } as const;
  const info = await json<{ query: { pages: Record<string, { imageinfo?: Info[] }> } }>(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '1600', titles: `File:${file}`, format: 'json' })}`,
  );
  const ii = Object.values(info.query.pages)[0]?.imageinfo?.[0];
  if (!ii) return { skip: `${file} is not on Commons (likely fair use)` } as const;
  const meta = ii.extmetadata ?? {};
  const license = strip(meta.LicenseShortName?.value);
  if (/\b(logo|wordmark|seal)\b/i.test(strip(meta.ImageDescription?.value))) return { skip: `${file} is a logo` } as const;
  if (!OK_LICENSES.test(license)) return { skip: `${file}: licence "${license}" not open` } as const;
  if (!ii.mime || !/jpe?g|png|webp/.test(ii.mime)) return { skip: `${file}: ${ii.mime}` } as const;
  const name = file.replace(/\.(jpe?g|png|webp|tiff?)$/i, '').replace(/_/g, ' ');
  return {
    imageUrl: ii.thumburl ?? ii.url!,
    filename: `story-lead-${file.replace(/[^\w.-]+/g, '-')}`.replace(/\.(tiff?)$/i, '.jpg'),
    data: {
      alt: strip(meta.ImageDescription?.value).slice(0, 300) || name,
      source: 'wikimedia_commons' as const,
      sourceUrl: ii.descriptionurl,
      license,
      licenseUrl: meta.LicenseUrl?.value || (/^(public domain|pd)/i.test(license) ? PD_MARK : undefined),
      creator: strip(meta.Artist?.value) || undefined,
      credit: strip(meta.Credit?.value) || 'Wikimedia Commons',
      attributionText: strip(meta.Attribution?.value) || `${name}, ${license}, via Wikimedia Commons`,
      capturedAt: strip(meta.DateTimeOriginal?.value ?? meta.DateTime?.value) || undefined,
      shareAlike: /by-sa/i.test(license),
      noDerivatives: false,
      role: 'hero' as const,
      ingestedAt: new Date().toISOString(),
    },
  };
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });
const { docs: stories } = await payload.find({ collection: 'stories', limit: 200, depth: 0, pagination: false, overrideAccess: true });
const dir = await mkdtemp(path.join(tmpdir(), 'harlem-story-leads-'));
try {
  for (const story of stories) {
    const images = (story.images ?? []).map((i) => (typeof i === 'object' ? i.id : i));
    const source = story.sources?.find((s) => s.url?.includes('wikipedia.org/wiki/'))?.url;
    if (!source) {
      console.info(`skip ${story.slug}: no Wikipedia source`);
      continue;
    }
    await sleep(1_500);
    const lead = await leadImage(source);
    if ('skip' in lead) {
      console.info(`skip ${story.slug}: ${lead.skip}`);
      continue;
    }
    const existing = await payload.find({ collection: 'media', where: { sourceUrl: { equals: lead.data.sourceUrl } }, limit: 1, depth: 0, overrideAccess: true });
    let mediaId = existing.docs[0]?.id;
    if (mediaId && images[0] === mediaId) {
      console.info(`ok   ${story.slug}: already leads with ${lead.data.alt.slice(0, 50)}`);
      continue;
    }
    console.info(`${apply ? 'add ' : 'plan'} ${story.slug}: ${lead.data.alt.slice(0, 60)} [${lead.data.license}]`);
    if (!apply) continue;
    if (!mediaId) {
      const res = await fetch(lead.imageUrl, { headers: HEADERS, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) {
        console.warn(`  download failed (${res.status})`);
        continue;
      }
      const filePath = path.join(dir, lead.filename);
      await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
      mediaId = (await payload.create({ collection: 'media', overrideAccess: true, data: lead.data, filePath })).id;
    }
    await payload.update({
      collection: 'stories',
      id: story.id,
      overrideAccess: true,
      data: { images: [mediaId, ...images.filter((id) => id !== mediaId)] },
    });
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
process.exit(0);
