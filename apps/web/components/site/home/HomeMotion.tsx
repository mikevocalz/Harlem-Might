'use client';

import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { useHomeMotion } from '../motion';

/**
 * The home page's only client island (ADR-01). It binds the choreography in
 * ../motion by marker id over `document` and renders nothing, so every
 * heading, paragraph and bento on `/` stays server-rendered HTML.
 */
export function HomeMotion() {
  const reducedMotion = useBrowserReducedMotion('system');
  useHomeMotion(reducedMotion);
  return null;
}
