// TS resolution anchor. Metro and Next load YouTubeEmbed.native.tsx /
// YouTubeEmbed.web.tsx — the shared screens import from this file so each
// platform gets its own player inside the UI boundary.
export { YouTubeEmbed } from './YouTubeEmbed.web';
export type { YouTubeEmbedProps } from './YouTubeEmbed.web';
