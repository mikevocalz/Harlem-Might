import { getPayload } from 'payload';
import config from './payload.config';

// Publishes every draft walk. Stories publish the same way; walks just never
// got their run. `pnpm publish:walks` lists; `--apply` flips _status.

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to publish walks.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });

let published = 0;
for (let page = 1; ; page++) {
  const result = await payload.find({ collection: 'walks', limit: 100, page, depth: 0, overrideAccess: true, draft: true });
  for (const doc of result.docs) {
    if (doc._status === 'published') continue;
    if (!apply) {
      console.info(`Draft walk ${doc.slug} — ${doc.title}`);
      continue;
    }
    await payload.update({ collection: 'walks', id: doc.id, overrideAccess: true, data: { _status: 'published' } });
    console.info(`Published walk ${doc.slug}`);
    published++;
  }
  if (!result.hasNextPage) break;
}
console.info(apply ? `Published ${published} walks.` : 'Preview only; pass --apply to publish.');
