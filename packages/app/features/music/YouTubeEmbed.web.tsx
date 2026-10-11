import { View } from '@acme/ui/tw';
import { youTubeEmbedUrl } from './music-format.ts';

export interface YouTubeEmbedProps {
  /** Verified watch/share URL from the CMS. */
  url: string;
  /** Accessible title, e.g. the featured song's title. */
  title: string;
}

/**
 * The featured-song player on web: a youtube-nocookie iframe inside the UI
 * boundary. The iframe's audio can never enter the spatial engine — it plays
 * straight to the device output like any embed.
 */
export function YouTubeEmbed({ url, title }: YouTubeEmbedProps) {
  const src = youTubeEmbedUrl(url);
  if (!src) return null;
  return (
    <View className="aspect-video w-full overflow-hidden bg-mights-night">
      <iframe
        src={src}
        title={title}
        allow="accelerometer; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full border-0"
      />
    </View>
  );
}
