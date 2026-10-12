import { createContentReaders, createRestContentSource } from '@acme/app/content';
import { PAYLOAD_API_BASE } from './payload';

// Vite stays a REST-only consumer of the CMS hosted by apps/web.
export const eventReaders = createContentReaders(createRestContentSource({
  apiUrl: PAYLOAD_API_BASE,
  fetch: (url, init) => fetch(url, init),
}));
