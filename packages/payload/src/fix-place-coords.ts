import { getPayload } from 'payload';
import { fixPlaceCoords } from './fix-place-coords-runner.ts';
import config from './payload.config';

const payload = await getPayload({ config });
const result = await fixPlaceCoords(payload, process.argv.includes('--apply'));
process.exit(result.exitCode);
