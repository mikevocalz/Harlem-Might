'use client';

import { createContentReaders, createRestContentSource } from '@acme/app/content';
import { MusicIndexScreen, type MusicFirstPage } from '@acme/app/features/music/MusicIndexScreen.tsx';

// Page 1 is server-rendered by the route; further pages read Payload's REST
// mount same-origin — the same contract the app uses, no second read path.
const readers = createContentReaders(
  createRestContentSource({ apiUrl: '/payload-api', fetch: (url, init) => fetch(url, init) }),
);

export function MusicIndexClient({ firstPage }: { firstPage: MusicFirstPage | undefined }) {
  return <MusicIndexScreen firstPage={firstPage} fetchPage={readers.listMusicArtistsPage} />;
}
