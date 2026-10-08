'use client';

import { useSyncExternalStore } from 'react';

/**
 * Subscribes to a media query. The server snapshot is `false`, so markup that
 * depends on it must be correct for the wide layout first and only add
 * behaviour on match (here: the modal state of the full-height phone sheet).
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
