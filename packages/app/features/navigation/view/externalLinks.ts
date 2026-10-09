import type { GeographicCoordinate } from '../model/geo.ts';
import { arrivalTarget, type ExternalMapsHandoff, type RouteDestination, type TravelMode } from '../model/route.ts';
import { buildExternalMapsHandoff } from '../providers/externalMaps.ts';

/**
 * Apple Maps and Google Maps links for the trip. With an origin this is the
 * domain's handoff (same URLs the transit `unsupported` answer carries);
 * without one, the destination alone, and each app starts from the person's
 * own location. Aims at the entrance when the place has one.
 */
export function externalMapsLinks(
  destination: RouteDestination,
  mode: TravelMode,
  origin?: GeographicCoordinate,
): ExternalMapsHandoff {
  if (origin) return buildExternalMapsHandoff({ origin, destination, mode });
  const target = arrivalTarget(destination);
  const point = `${target.latitude},${target.longitude}`;
  const apple = new URLSearchParams({ daddr: point, dirflg: { walking: 'w', cycling: 'c', driving: 'd', transit: 'r' }[mode] });
  const google = new URLSearchParams({
    api: '1',
    destination: point,
    travelmode: { walking: 'walking', cycling: 'bicycling', driving: 'driving', transit: 'transit' }[mode],
  });
  return {
    appleMapsUrl: `https://maps.apple.com/?${apple}`,
    googleMapsUrl: `https://www.google.com/maps/dir/?${google}`,
  };
}
