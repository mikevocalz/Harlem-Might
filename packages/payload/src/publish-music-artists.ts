import { getPayload } from 'payload';
import config from './payload.config';

// Publishes every draft music artist — same run publish-walks never got for
// the music directory. `pnpm publish:music-artists` lists; `--apply` flips
// _status. Drafts without a name or slug are skipped: an entry nobody can
// identify should not go live.

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to publish music artists.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });

let published = 0;
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'music-artists', limit: 100, page, depth: 0, overrideAccess: true, draft: true });
  for (const doc of result.docs) {
    if (doc._status === 'published') continue;
    if (!doc.name || !doc.slug) {
      console.info(`Skipping artist ${doc.id} — no name or slug.`);
      continue;
    }
    if (!apply) {
      console.info(`Draft artist ${doc.slug} — ${doc.name}`);
      continue;
    }
    await payload.update({ collection: 'music-artists', id: doc.id, overrideAccess: true, data: { _status: 'published' } });
    published++;
  }
  if (!result.hasNextPage) break;
}
console.info(apply ? `Published ${published} music artists.` : 'Preview only; pass --apply to publish.');
process.exit(0);
