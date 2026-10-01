'use client';
import { View } from '@acme/ui/tw';
import type { YouTubeEmbedProps } from './YouTubeEmbed.types.ts';

/**
 * Web needs no bridge — the browser embeds YouTube's iframe directly, which is
 * what the native player is a wrapper around anyway.
 */
export function YouTubeEmbed({ videoId, className }: YouTubeEmbedProps) {
  return (
    <View
      className={`my-2 overflow-hidden rounded-md border-2 border-border bg-ink-950 ${className ?? ''}`}
      style={{ aspectRatio: 16 / 9 }}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video"
        // nocookie + these permissions are what YouTube's embed docs specify;
        // omitting `allowFullScreen` silently disables the fullscreen control.
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    </View>
  );
}
