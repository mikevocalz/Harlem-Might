import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { contentQuery, contentQueryResult } from '@acme/app/content';
import { MusicArtistScreen } from '@acme/app/features/music/MusicArtistScreen.tsx';
import { contentReaders } from '@/src/site/content-readers';

export default function MusicArtistRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const artist = useQuery({ queryKey: ['music-artist', slug], queryFn: ({ signal }) => contentQuery(contentReaders.getMusicArtist(slug, { signal })) });
  return <MusicArtistScreen slug={slug} result={contentQueryResult(artist)} />;
}
