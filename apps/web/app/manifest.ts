import type { MetadataRoute } from 'next';
import { palette } from '@acme/theme';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Harlem Might',
    short_name: 'Harlem Might',
    description: 'Places, walks and the history attached to each corner of Harlem, on one map.',
    start_url: '/',
    display: 'standalone',
    background_color: palette.mights['warm-black'],
    theme_color: palette.mights['warm-black'],
    icons: [{ src: '/icon.png', sizes: 'any', type: 'image/png' }],
  };
}
