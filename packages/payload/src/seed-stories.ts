import { getPayload } from 'payload';
import config from './payload.config';
import { dekFrom } from './first-sentence';
import type { Story } from './payload-types';

// Wikipedia article plain-text extracts (CC BY-SA 4.0) become stories — real,
// source-cited text a curator rewrites into editorial voice before publish.
// `author` credits Wikipedia contributors, `sources` cites the article, and
// each story links the catalogue places and imported media that name-match.
//
// Existing seeded drafts are overwritten with the latest full extract so
// intros can be replaced, and every managed topic is published. Payload's
// default max text length caps textarea fields at 40,000 characters, so very
// long extracts are trimmed at a word boundary while keeping the full article
// structure up to that limit.
//
// `pnpm seed:stories` previews; `--apply` upserts drafts and publishes them.

type Topic = {
  title: string; // story title
  slug: string;
  article?: string; // Wikipedia article title (defaults to title)
  places: string[];
};

const TOPICS: Topic[] = [
  { title: 'Harlem', slug: 'harlem', places: [] },
  { title: 'Harlem Renaissance', slug: 'harlem-renaissance', places: [] },
  { title: 'Apollo Theater', slug: 'apollo-theater-story', places: ['apollo theater'] },
  { title: 'Studio Museum in Harlem', slug: 'studio-museum-story', places: ['studio museum'] },
  { title: 'Marcus Garvey Park', slug: 'marcus-garvey-park-story', places: ['marcus garvey park', 'mount morris park'] },
  { title: 'Abyssinian Baptist Church', slug: 'abyssinian-baptist-story', places: ['abyssinian'] },
  { title: 'Schomburg Center for Research in Black Culture', slug: 'schomburg-center-story', places: ['schomburg'] },
  { title: '125th Street (Manhattan)', slug: '125th-street-story', places: ['125th street'] },
  { title: "Strivers' Row", article: 'St. Nicholas Historic District', slug: 'strivers-row-story', places: ['strivers'] },
  { title: 'Hotel Theresa', slug: 'hotel-theresa-story', places: ['hotel theresa', 'theresa'] },
  { title: 'Cotton Club (New York City)', slug: 'cotton-club-story', places: ['cotton club'] },
  { title: 'Savoy Ballroom', slug: 'savoy-ballroom-story', places: ['savoy'] },
  { title: "Minton's Playhouse", slug: 'mintons-playhouse-story', places: ['minton'] },
  { title: "Sylvia's Restaurant of Harlem", slug: 'sylvias-story', places: ['sylvia'] },
  { title: 'James Van Der Zee', slug: 'james-van-der-zee-story', places: [] },
  { title: 'Langston Hughes', slug: 'langston-hughes-story', places: [] },
  { title: 'Malcolm X', slug: 'malcolm-x-story', places: ['malcolm shabazz'] },
  { title: 'Zora Neale Hurston', slug: 'zora-neale-hurston-story', places: [] },
  { title: 'Duke Ellington', slug: 'duke-ellington-story', places: [] },
  { title: 'Madam C. J. Walker', slug: 'madam-c-j-walker-story', places: [] },
  { title: 'W. E. B. Du Bois', slug: 'w-e-b-du-bois-story', places: [] },
  { title: 'Marcus Garvey', slug: 'marcus-garvey-story', places: ['marcus garvey'] },
  { title: 'The Harlem Hellfighters', article: '369th Infantry Regiment (United States)', slug: 'harlem-hellfighters-story', places: ['369th'] },
  { title: 'Sugar Hill, Manhattan', slug: 'sugar-hill-story', places: ['sugar hill'] },
  { title: 'Rucker Park', slug: 'rucker-park-story', places: ['rucker'] },
];

type WikiExtract = { title?: string; extract?: string };

async function wikiExtract(article: string): Promise<WikiExtract | undefined> {
  const result = (await (
    await fetch(
      `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
        action: 'query',
        prop: 'extracts',
        explaintext: 'true',
        redirects: 'true',
        format: 'json',
        titles: article,
      })}`,
      {
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': process.env.EVENTS_SCRAPER_USER_AGENT ?? 'HarlemMightBot/1.0' },
      },
    )
  ).json()) as { query?: { pages?: Record<string, WikiExtract> } };
  return Object.values(result.query?.pages ?? {})[0];
}

// Payload's default textarea max length is 40,000 characters. Trim long
// extracts at a word boundary without cutting the trailing ellipsis short.
const MAX_BODY_LENGTH = 40_000;
function trimBody(text: string): string {
  if (text.length <= MAX_BODY_LENGTH) return text;
  const cut = text.slice(0, MAX_BODY_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : MAX_BODY_LENGTH)}…`;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to import stories.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });

// Full place + media catalogues for relationship matching.
const placesById = new Map<number, { name: string }>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'places', limit: 100, page, depth: 0, overrideAccess: true });
  result.docs.forEach((doc) => placesById.set(doc.id, { name: doc.name }));
  if (!result.hasNextPage) break;
}
const mediaById = new Map<number, { alt: string }>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'media', limit: 100, page, depth: 0, overrideAccess: true });
  result.docs.forEach((doc) => mediaById.set(doc.id, { alt: doc.alt }));
  if (!result.hasNextPage) break;
}
const placeEntries = [...placesById.entries()];
const mediaEntries = [...mediaById.entries()];

const existingBySlug = new Map<string, number>();
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'stories', limit: 100, page, depth: 0, overrideAccess: true, draft: true });
  result.docs.forEach((doc) => existingBySlug.set(doc.slug, doc.id));
  if (!result.hasNextPage) break;
}

const managedSlugs = new Set(TOPICS.map((t) => t.slug));
const accessedAt = new Date().toISOString();
const created: { data: Record<string, unknown> }[] = [];
const updated: { id: number; data: Record<string, unknown> }[] = [];

for (const topic of TOPICS) {
  const articleTitle = topic.article ?? topic.title;
  const wiki = await wikiExtract(articleTitle);
  if (!wiki?.extract || wiki.extract.length < 200) {
    console.warn(`Skipping ${topic.slug}: no usable Wikipedia extract.`);
    continue;
  }
  const body = trimBody(wiki.extract.trim());
  const placeIds = topic.places.flatMap((needle) =>
    placeEntries.filter(([, p]) => p.name.toLowerCase().includes(needle)).map(([id]) => id).slice(0, 3),
  );
  const keywords = [
    topic.title.split('(')[0]!.replace(/'s$/, '').trim(),
    articleTitle.split('(')[0]!.replace(/'s$/, '').trim(),
    ...topic.places.map((p) => p.replace(/'s$/, '')),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const imageIds = mediaEntries
    .filter(([, m]) => keywords.some((k) => k.length > 3 && m.alt.toLowerCase().includes(k.toLowerCase())))
    .map(([id]) => id)
    .slice(0, 3);
  const title = topic.title.replace(/\s*\(.*\)/, '');
  const data: Record<string, unknown> = {
    title,
    slug: topic.slug,
    dek: dekFrom(body),
    body,
    author: 'Wikipedia contributors',
    places: placeIds,
    images: imageIds,
    sources: [
      {
        label: `Wikipedia — ${wiki.title ?? articleTitle} (CC BY-SA 4.0)`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((wiki.title ?? articleTitle).replace(/ /g, '_'))}`,
        accessedAt,
      },
    ],
  };
  const existingId = existingBySlug.get(topic.slug);
  if (existingId) {
    // Replace only the fields that come from the refreshed extract so
    // manual curator edits to places/images are preserved.
    updated.push({
      id: existingId,
      data: {
        title,
        slug: topic.slug,
        dek: data.dek,
        body: data.body,
        sources: data.sources,
      },
    });
  } else {
    created.push({ data });
  }
}

console.info(`Wikipedia topics ${TOPICS.length}; existing ${existingBySlug.size}; create ${created.length}; update ${updated.length}.`);
if (!apply) {
  const sample = [...created, ...updated]
    .slice(0, 8)
    .map((s) => `${s.data.title} [places:${(s.data.places as number[] | undefined)?.length ?? 0}, images:${(s.data.images as number[] | undefined)?.length ?? 0}]`);
  console.info(`Preview only; pass --apply to upsert and publish. Sample: ${sample.join('; ')}`);
} else {
  for (const story of created) {
    await payload.create({ collection: 'stories', overrideAccess: true, draft: true, data: story.data as unknown as Story });
    console.info(`Created draft story ${story.data.slug}`);
  }
  for (const story of updated) {
    await payload.update({ collection: 'stories', id: story.id, overrideAccess: true, draft: true, data: story.data as unknown as Story });
    console.info(`Updated draft story ${story.data.slug}`);
  }

  let published = 0;
  for (let page = 1; ; page++) {
    const result = await payload.find({ collection: 'stories', limit: 100, page, depth: 0, overrideAccess: true, draft: true });
    for (const doc of result.docs) {
      if (!managedSlugs.has(doc.slug)) continue;
      if (doc._status === 'published') continue;
      await payload.update({ collection: 'stories', id: doc.id, overrideAccess: true, data: { _status: 'published' } });
      console.info(`Published story ${doc.slug}`);
      published++;
    }
    if (!result.hasNextPage) break;
  }
  console.info(`Created ${created.length}, updated ${updated.length}, published ${published} stories.`);
}
