/** Query keys for the music domain — one factory, no inline arrays. */
export const musicKeys = {
  artists: ['music-artists'] as const,
  artist: (slug: string) => ['music-artist', slug] as const,
};
