import { cache } from 'react';
import { getStory } from '@acme/payload/server';

// One read per request: generateMetadata and the page share it.
export const loadStory = cache((slug: string) => getStory(slug));
