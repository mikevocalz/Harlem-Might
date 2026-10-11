import { getPayload } from 'payload';
import config from './payload.config';
import { publishMusicArtists } from './publish-music-artists-runner.ts';

// Publishes every draft music artist — same run publish-walks never got for
// the music directory. `pnpm publish:music-artists` lists; `--apply` flips
// _status. Drafts without a name or slug are skipped: an entry nobody can
// identify should not go live.

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to publish music artists.');
const apply = process.argv.includes('--apply');
const payload = await getPayload({ config });

const { failed } = await publishMusicArtists(payload, apply);
process.exit(failed ? 1 : 0);
