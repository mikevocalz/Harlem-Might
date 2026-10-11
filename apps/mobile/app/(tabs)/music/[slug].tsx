import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { MusicArtistScreen } from '@acme/app/features/music/MusicArtistScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function MusicArtistRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const artist = useQuery({ queryKey: ['music-artist', slug], queryFn: () => contentReaders.getMusicArtist(slug) });
  return <MusicArtistScreen slug={slug} result={artist.data} />;
}
