import { getPayload } from 'payload';
import { enrichPlacesMenus } from './enrich-places-menus-runner.ts';
import config from './payload.config';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const payload = await getPayload({ config });
const result = await enrichPlacesMenus(payload, process.argv.includes('--apply'));
process.exitCode = result.exitCode;
