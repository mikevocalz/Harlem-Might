import { View } from '@acme/ui/tw';
import { YoutubeView, useYouTubePlayer } from 'react-native-youtube-bridge';
import { youTubeVideoId } from './music-format.ts';

export interface YouTubeEmbedProps {
  /** Verified watch/share URL from the CMS. */
  url: string;
  /** Accessible label, e.g. the featured song's title. */
  title: string;
}

/**
 * The featured-song player on native: the shared YouTube bridge (same player
 * UI the iframe gives on web). Its audio never enters the spatial engine.
 */
export function YouTubeEmbed({ url, title }: YouTubeEmbedProps) {
  const videoId = youTubeVideoId(url);
  const player = useYouTubePlayer(videoId ?? '', { controls: true, playsinline: true, rel: false });
  if (!videoId) return null;
  return (
    <View accessibilityLabel={title} className="aspect-video w-full overflow-hidden bg-mights-night">
      <YoutubeView player={player} width="100%" height="100%" />
    </View>
  );
}
