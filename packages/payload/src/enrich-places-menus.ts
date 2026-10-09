import { getPayload } from 'payload';
import { isHttpUrl } from './fields/provenance.ts';
import config from './payload.config';

// Menu discovery: fetch each place's official homepage and look for an anchor
// whose text or href says "menu". Only links actually published by the venue
// get recorded — nothing is guessed at a URL shape. `sourceUrl` records which
// page the link was found on, and the record stays a draft-level claim until
// a curator verifies it.
//
// `pnpm enrich:menus` previews; `--apply` writes. Scoped to places that have
// a website and no menu record yet, biased to Food/featured first.

const CONCURRENCY = 8;
const MAX_SITES = 400;
const MENU_PATTERN = /menu|eat|food/i;
const SKIP_HOSTS = /facebook|instagram|twitter|x\.com|yelp|tripadvisor|google|linktr/i;

const UA = { 'User-Agent': process.env.EVENTS_SCRAPER_USER_AGENT ?? 'HarlemMightBot/1.0' };

type Row = { id: number; slug: string; name: string; website: string; primaryCategory?: string | null; featured?: boolean | null };

function findMenuLinks(html: string, baseUrl: string): string[] {
  const found = new Set<string>();
  const anchor = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchor.exec(html)) !== null) {
    const [, href, text] = match;
    if (!href || (!MENU_PATTERN.test(href) && !MENU_PATTERN.test((text ?? '').replace(/<[^>]+>/g, ' ')))) continue;
    try {
      const absolute = new URL(href, baseUrl);
      if (absolute.protocol !== 'https:' && absolute.protocol !== 'http:') continue;
      if (SKIP_HOSTS.test(absolute.hostname)) continue;
      absolute.hash = '';
      found.add(absolute.href);
    } catch {
      continue;
    }
    if (found.size >= 3) break;
  }
  return [...found];
}

async function fetchHome(url: string): Promise<{ html: string; finalUrl: string } | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { ...UA, Accept: 'text/html' }, redirect: 'follow' });
    if (!response.ok || !response.headers.get('content-type')?.includes('html')) return undefined;
    // Menu links are in the nav/header — the first chunk is enough.
    return { html: (await response.text()).slice(0, 400_000), finalUrl: response.url };
  } catch {
    return undefined;
  }
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });

const rows: Row[] = [];
for (let page = 1; ; page++) {
  const result = await payload.find({
    collection: 'places',
    where: { website: { exists: true } },
    limit: 100,
    page,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, name: true, website: true, primaryCategory: true, featured: true, menus: true },
  });
  rows.push(...(result.docs as unknown as (Row & { menus?: { label?: string }[] | null })[]).filter((row) => !row.menus?.length));
  if (!result.hasNextPage) break;
}
// Food places first — menus are a restaurant/bar/café concern.
const queue = rows
  .sort((a, b) => Number(b.featured === true || b.primaryCategory === 'Food') - Number(a.featured === true || a.primaryCategory === 'Food'))
  .slice(0, MAX_SITES);

console.info(`Places with a website and no menu record: ${rows.length}; checking ${queue.length} homepages.`);

const found: { row: Row; links: string[] }[] = [];
let cursor = 0;
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < queue.length) {
    const row = queue[cursor++]!;
    const page = await fetchHome(row.website);
    if (!page) continue;
    const links = findMenuLinks(page.html, page.finalUrl).filter((link) => isHttpUrl(link));
    if (links.length) found.push({ row, links });
  }
});
await Promise.all(workers);

console.info(`Found menu links for ${found.length} places of ${queue.length} checked.`);
if (!apply) {
  console.info(`Preview only; pass --apply to write. Sample: ${found.slice(0, 15).map((f) => `${f.row.name} → ${f.links[0]}`).join('; ')}`);
} else {
  const verifiedAt = new Date().toISOString();
  for (const { row, links } of found) {
    const menus = links.map((url, index) => ({
      label: index === 0 ? 'Menu' : `Menu (${index + 1})`,
      format: 'web' as const,
      url,
      sourceUrl: row.website,
      lastVerifiedAt: verifiedAt,
      active: true,
    }));
    await payload.update({ collection: 'places', id: row.id, data: { menus }, overrideAccess: true });
    console.info(`${row.slug}: +${links.length} menu link(s)`);
  }
  console.info(`Wrote menus for ${found.length} places.`);
}
