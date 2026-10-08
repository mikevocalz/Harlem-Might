// Display formatting for navigation screens. Pure: no React, no store, so
// `node --test` runs it directly and web and native print the same strings.

/**
 * A distance for display. Under 1 km: metres, rounded to 10 m (5 m under
 * 100 m, where a turn is close). From 1 km: kilometres with one decimal.
 * Matches Explore's `formatDistance` above 100 m so a place row and its
 * route never disagree.
 */
export function formatRouteDistance(meters: number, locale?: string): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  const km = meters >= 1000;
  const step = meters < 100 ? 5 : 10;
  const value = km ? Math.round(meters / 100) / 10 : Math.round(meters / step) * step;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: km ? 'kilometer' : 'meter',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${value} ${km ? 'km' : 'm'}`;
  }
}

/**
 * A duration for display: "1 min" at minimum (a route is never "0 min"),
 * whole minutes under an hour, "1 hr 5 min" above.
 */
export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Spoken form of {@linkcode formatRouteDuration} for screen readers ("12 minutes"). */
export function spokenRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (minutes < 60) return unit(minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? unit(hours, 'hour') : `${unit(hours, 'hour')} ${unit(rest, 'minute')}`;
}

/**
 * Clock time of arrival, e.g. "4:05 PM". `timeZone` is for tests; screens
 * leave it to the device.
 */
export function formatArrivalClock(epochMs: number, locale?: string, timeZone?: string): string {
  if (!Number.isFinite(epochMs)) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(epochMs));
  } catch {
    const d = new Date(epochMs);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
