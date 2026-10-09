'use client';

import { useMemo } from 'react';
import Svg, { Polyline } from 'react-native-svg';
import { useStore } from 'zustand';
import { semantic } from '@acme/theme';
import { View } from '@acme/ui/tw';
import { projectToSchematic, type SchematicBounds } from '../../explore/schematic-map';
import type { GeographicCoordinate } from '../model/geo';
import { navigationFixStore } from '../session/navigationStore';
import { simplifyRoute, splitRouteAt, type DisplayedRoute } from '../view/routeLine';

// Dark only (DECISIONS S14), so the dark values. Gold, not the cyan `route`
// token: the AR spec asks for gold/warm guidance on every surface, and the
// map line and the AR chevrons must read as the same route.
const LINE = semantic.primary.dark;
const WALKED = semantic['rule-rail'].dark;
const PUCK_FILL = semantic.text.dark;
const PUCK_RING = semantic.primary.dark;

/** Douglas–Peucker tolerance for the schematic line. Finer than any marker on a phone-sized box. */
const SIMPLIFY_M = 4;

const toPoints = (coordinates: readonly GeographicCoordinate[], bounds: SchematicBounds) =>
  coordinates
    .map((c) => {
      const p = projectToSchematic([c.longitude, c.latitude], bounds);
      return `${p.xPercent.toFixed(2)},${p.yPercent.toFixed(2)}`;
    })
    .join(' ');

export interface RouteSchematicLayerProps {
  route: DisplayedRoute;
  /** The fit the markers use, so the line lands on them. */
  bounds: SchematicBounds;
}

/**
 * The route on the schematic map: a gold line from the session's real route
 * geometry, fitted to the same box as the markers. Redrawn when the route id
 * or generation changes (a reroute), never recomputed. During guidance the
 * walked part dims and a puck marks the matched position.
 *
 * Decorative for screen readers: the step list and HUD carry the content.
 * Drawn under the markers so a place stays tappable where the line crosses it.
 */
export function RouteSchematicLayer({ route, bounds }: RouteSchematicLayerProps) {
  const simplified = useMemo(
    () => simplifyRoute(route.route.geometry.coordinates, SIMPLIFY_M),
    // id and generation identify the geometry; the object is immutable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route.route.id, route.generation],
  );
  return (
    <View aria-hidden pointerEvents="none" className="absolute inset-0">
      {route.kind === 'active' ? (
        <ActiveLine coordinates={route.route.geometry.coordinates} simplified={simplified} bounds={bounds} />
      ) : (
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Polyline
            points={toPoints(simplified, bounds)}
            fill="none"
            stroke={LINE}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      )}
    </View>
  );
}

/**
 * The only part that follows the per-fix store: the walked/ahead split and
 * the puck. The split uses the full geometry's segment index, so it is cut
 * there and simplified after.
 */
function ActiveLine({
  coordinates,
  simplified,
  bounds,
}: {
  coordinates: readonly GeographicCoordinate[];
  simplified: readonly GeographicCoordinate[];
  bounds: SchematicBounds;
}) {
  const match = useStore(navigationFixStore, (s) => (s.match?.kind === 'matched' ? s.match : undefined));
  const raw = useStore(navigationFixStore, (s) => (s.lastFix?.kind === 'accepted' ? s.lastFix.filtered.coordinate : undefined));
  const split = match ? splitRouteAt(coordinates, match) : undefined;
  const puck = match?.coordinate ?? raw;
  const puckPoint = puck ? projectToSchematic([puck.longitude, puck.latitude], bounds) : undefined;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      {split ? (
        <>
          <Polyline
            points={toPoints(simplifyRoute(split.walked, SIMPLIFY_M), bounds)}
            fill="none"
            stroke={WALKED}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <Polyline
            points={toPoints(simplifyRoute(split.ahead, SIMPLIFY_M), bounds)}
            fill="none"
            stroke={LINE}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : (
        <Polyline
          points={toPoints(simplified, bounds)}
          fill="none"
          stroke={LINE}
          strokeWidth={5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {puckPoint ? (
        // In a stretched 0–100 box a circle would become an ellipse, so the
        // puck is a zero-length round-capped line: its cap stays circular.
        <>
          <Polyline
            points={`${puckPoint.xPercent},${puckPoint.yPercent} ${puckPoint.xPercent},${puckPoint.yPercent}`}
            stroke={PUCK_RING}
            strokeWidth={18}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <Polyline
            points={`${puckPoint.xPercent},${puckPoint.yPercent} ${puckPoint.xPercent},${puckPoint.yPercent}`}
            stroke={PUCK_FILL}
            strokeWidth={11}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </Svg>
  );
}

