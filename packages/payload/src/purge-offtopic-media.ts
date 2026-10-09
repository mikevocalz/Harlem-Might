import { getPayload } from 'payload';
import config from './payload.config';

// One-off cleanup: media rows the Commons import let through that aren't
// Harlem NYC (identified by alt text after the first import run).
const OFFTOPIC = /covington|kentucky|montana|siegen|düsseldorf|dusseldorf|emden|brockton|pitlochry|jacksonville|armoury|usmc/i;

const payload = await getPayload({ config });
const found = await payload.find({ collection: 'media', limit: 500, depth: 0, overrideAccess: true });
const bad = found.docs.filter((doc) => OFFTOPIC.test(doc.alt ?? ''));
for (const doc of bad) {
  await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true });
  console.info(`Deleted ${doc.id}: ${doc.alt}`);
}
console.info(`Deleted ${bad.length} off-topic media rows.`);
