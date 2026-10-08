import type { GeographicCoordinate } from '../model/geo.ts';
import { arrivalTarget, type ExternalMapsHandoff, type RouteRequest, type TravelMode } from '../model/route.ts';

const latLng = (c: GeographicCoordinate) => `${c.latitude},${c.longitude}`;

const APPLE_FLAG: Record<TravelMode, string> = { walking: 'w', cycling: 'c', driving: 'd', transit: 'r' };
const GOOGLE_MODE: Record<TravelMode, string> = {
  walking: 'walking',
  cycling: 'bicycling',
  driving: 'driving',
  transit: 'transit',
};

/**
 * Links that open the trip in Apple Maps or Google Maps. Used for modes no
 * provider here can route, so the person gets real transit directions
 * instead of a fake line.
 *
 * Apple Maps URL scheme: `saddr`, `daddr`, `dirflg` (r = transit).
 * Google Maps URLs: `api=1`, `origin`, `destination`, `travelmode`.
 */
export function buildExternalMapsHandoff(request: RouteRequest): ExternalMapsHandoff {
  const destination = arrivalTarget(request.destination);
  const apple = new URLSearchParams({
    saddr: latLng(request.origin),
    daddr: latLng(destination),
    dirflg: APPLE_FLAG[request.mode],
  });
  const google = new URLSearchParams({
    api: '1',
    origin: latLng(request.origin),
    destination: latLng(destination),
    travelmode: GOOGLE_MODE[request.mode],
  });
  return {
    appleMapsUrl: `https://maps.apple.com/?${apple}`,
    googleMapsUrl: `https://www.google.com/maps/dir/?${google}`,
  };
}
