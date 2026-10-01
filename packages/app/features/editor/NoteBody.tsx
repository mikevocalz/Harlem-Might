'use client';
import { EnrichedText } from 'react-native-enriched-html';
import { View } from '@acme/ui/tw';
import { AudioPlayer } from '@acme/ui';
import { palette } from '@acme/theme';
import { splitNoteSegments } from './youtube.ts';
import { YouTubeEmbed } from './YouTubeEmbed';

export interface NoteBodyProps {
  /** The note's HTML, as produced by the editor. */
  html: string;
  className?: string;
}

/**
 * A saved note, rendered for reading.
 *
 * The editor stores a YouTube video as an ordinary link, because its schema has
 * no video node. This is where that link becomes a player: the HTML is split
 * around recognised YouTube anchors, the text runs render through
 * `EnrichedText`, and each video renders as an embed in the position its link
 * occupied. The document stays portable — anything that can read HTML still
 * sees a valid link — while a reader sees the video inline.
 *
 * A note with no videos comes back as a single segment and renders exactly as
 * it did before, so this costs nothing for the common case.
 */
export function NoteBody({ html, className }: NoteBodyProps) {
  const segments = splitNoteSegments(html);

  return (
    <View className={`gap-1 ${className ?? ''}`}>
      {segments.map((segment, index) =>
        segment.kind === 'video' ? (
          <YouTubeEmbed key={`video-${segment.value}-${index}`} videoId={segment.value} />
        ) : segment.kind === 'audio' ? (
          <AudioPlayer key={`audio-${index}`} uri={segment.value} label={segment.label} />
        ) : (
          <EnrichedText
            key={`html-${index}`}
            style={{ color: palette.ink[950], fontSize: 16 }}
            htmlStyle={{
              blockquote: { borderColor: palette.ink[950], borderWidth: 2, gapWidth: 12 },
              code: { color: palette.ink[950], backgroundColor: palette.ink[100] },
            }}
          >
            {segment.value}
          </EnrichedText>
        ),
      )}
    </View>
  );
}
