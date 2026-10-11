import { MusicIndexScreen } from '@acme/app/features/music/MusicIndexScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function MusicRoute() {
  return <MusicIndexScreen firstPage={undefined} fetchPage={contentReaders.listMusicArtistsPage} />;
}
