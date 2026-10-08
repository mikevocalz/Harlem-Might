import { cache } from 'react';
import { getWalk } from '@acme/payload/server';

// One read per request: generateMetadata and the page share it.
export const loadWalk = cache((slug: string) => getWalk(slug));
