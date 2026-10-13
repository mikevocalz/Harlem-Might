import { getPayload } from 'payload';
import config from '../payload.config';
import { seedStoryLeadImages } from './seed-story-lead-images-runner.ts';

// `pnpm seed:story-images` previews; `--apply` downloads and attaches.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });
const { exitCode } = await seedStoryLeadImages(payload, apply);
process.exit(exitCode);
