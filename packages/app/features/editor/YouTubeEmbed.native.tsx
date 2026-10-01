'use client';
import { useYouTubePlayer, YoutubeView } from 'react-native-youtube-bridge';
import { View } from '@acme/ui/tw';
import type { YouTubeEmbedProps } from './YouTubeEmbed.types.ts';

/**
 * A YouTube video, rendered where the link sits in a note.
 *
 * `react-native-youtube-bridge` drives the IFrame Player API through a WebView,
 * so the player is YouTube's own — which is what its terms require, and what
 * gives captions, quality selection and the watch-later affordances for free.
 *
 * 16:9 because that is what YouTube serves; a fixed height would letterbox on
 * one pane width and crop on another, and this player appears at several widths
 * (a note in a detail pane, a note in a full-screen editor).
 */
export function YouTubeEmbed({ videoId, className }: YouTubeEmbedProps) {
  const player = useYouTubePlayer({ videoId });

  return (
    <View
      className={`my-2 overflow-hidden rounded-md border-2 border-border bg-ink-950 ${className ?? ''}`}
      // The border is the app's; the player fills inside it. `aspectRatio`
      // rather than a height so it scales with whatever pane it lands in.
      style={{ aspectRatio: 16 / 9 }}
    >
      <YoutubeView player={player} width="100%" height="100%" />
    </View>
  );
}
