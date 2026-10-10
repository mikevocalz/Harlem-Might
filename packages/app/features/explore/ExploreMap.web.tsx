'use client';

import type { ExploreMapProps } from './ExploreMap.types.ts';
import { ExploreSchematicMap } from './ExploreSchematicMap';

/**
 * The map inside ExploreMapPane on web: the schematic, as before. The site's
 * Explore page draws its own Mapbox GL JS map (apps/web/components/explore/
 * ExploreMap.tsx) and does not render this pane.
 */
export function ExploreMap(props: ExploreMapProps) {
  return <ExploreSchematicMap {...props} />;
}
