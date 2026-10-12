import { isHttpUrl } from '../fields/provenance.ts';

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

async function fetchHome(url: string, fetcher: typeof fetch): Promise<{ html: string; finalUrl: string } | undefined> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(15_000), headers: { ...UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('html')) return undefined;
  // Menu links are in the nav/header — the first chunk is enough.
  return { html: (await response.text()).slice(0, 400_000), finalUrl: response.url };
}

interface MenuPayload {
  find: (args: {
    collection: 'places'; where: { website: { exists: true } }; limit: number; page: number; depth: 0; overrideAccess: true;
    select: { slug: true; name: true; website: true; primaryCategory: true; featured: true; menus: true };
  }) => Promise<{ docs: unknown[]; hasNextPage: boolean }>;
  update: (args: {
    collection: 'places'; id: number; overrideAccess: true;
    data: { menus: { label: string; format: 'web'; url: string; sourceUrl: string; lastVerifiedAt: string; active: true }[] };
  }) => Promise<unknown>;
}

/** Best effort: retain successful discoveries, but any request/write failure fails the run. */
export async function enrichPlacesMenus(payload: MenuPayload, apply: boolean, {
  fetcher = fetch,
  log = console,
  now = () => new Date(),
}: { fetcher?: typeof fetch; log?: Pick<Console, 'info' | 'error'>; now?: () => Date } = {}) {
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

  log.info(`Places with a website and no menu record: ${rows.length}; checking ${queue.length} homepages.`);

  const found: { row: Row; links: string[] }[] = [];
  let cursor = 0;
  let checked = 0;
  let skipped = 0;
  let requestFailures = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < queue.length) {
      const row = queue[cursor++]!;
      try {
        const page = await fetchHome(row.website, fetcher);
        if (!page) {
          skipped++;
          continue;
        }
        checked++;
        const links = findMenuLinks(page.html, page.finalUrl).filter((link) => isHttpUrl(link));
        if (links.length) found.push({ row, links });
      } catch (error) {
        requestFailures++;
        log.error(`Could not check homepage for ${row.slug} (${row.website}).`, error);
      }
    }
  });
  await Promise.all(workers);

  log.info(`Found menu links for ${found.length} places of ${checked} homepages checked; ${skipped} non-HTML responses skipped; ${requestFailures} requests failed.`);
  let updated = 0;
  let writeFailures = 0;
  if (!apply) {
    log.info(`Preview only; pass --apply to write. Sample: ${found.slice(0, 15).map((f) => `${f.row.name} → ${f.links[0]}`).join('; ')}`);
  } else {
    const verifiedAt = now().toISOString();
    for (const { row, links } of found) {
      const menus = links.map((url, index) => ({
        label: index === 0 ? 'Menu' : `Menu (${index + 1})`,
        format: 'web' as const,
        url,
        sourceUrl: row.website,
        lastVerifiedAt: verifiedAt,
        active: true as const,
      }));
      try {
        await payload.update({ collection: 'places', id: row.id, data: { menus }, overrideAccess: true });
        updated++;
        log.info(`${row.slug}: +${links.length} menu link(s)`);
      } catch (error) {
        writeFailures++;
        log.error(`Could not write menus for ${row.slug}.`, error);
      }
    }
    log.info(`Wrote menus for ${updated} places; ${writeFailures} writes failed.`);
  }
  return { found: found.length, checked, skipped, requestFailures, updated, writeFailures, exitCode: requestFailures || writeFailures ? 1 : 0 };
}
