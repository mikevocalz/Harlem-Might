import { useQuery } from '@tanstack/react-query';
import { MusicIndexScreen } from '@acme/app/features/music/MusicIndexScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function MusicRoute() {
  const { data } = useQuery({ queryKey: ['music-artists'], queryFn: () => contentReaders.listMusicArtists() });
  return <MusicIndexScreen result={data} />;
}
