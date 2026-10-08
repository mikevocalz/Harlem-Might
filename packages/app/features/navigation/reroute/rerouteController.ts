import type { NavigationConfig } from '../config.ts';
import type { RouteRequest, RouteResponse } from '../model/route.ts';
import { isAbortError, RouteProviderError, type RouteProvider } from '../providers/routeProvider.ts';

/** Schedules `run` after `delayMs`; returns a function that cancels it. */
export type ScheduleFn = (run: () => void, delayMs: number) => () => void;

const defaultSchedule: ScheduleFn = (run, delayMs) => {
  const handle = setTimeout(run, delayMs);
  return () => clearTimeout(handle);
};

/** Callbacks owned by the navigation controller. */
export interface RerouteCallbacks {
  /** The request left the debounce and went to the provider. */
  onStart(attempt: number): void;
  /** The newest request finished. Older, superseded results are never delivered. */
  onResponse(response: RouteResponse, attempt: number): void;
  /** The newest request failed for a reason other than cancellation. */
  onFailure(error: RouteProviderError, attempt: number): void;
}

/**
 * Debounces, rate-limits and cancels reroute requests.
 *
 * - `request()` waits `debounceMs` so a burst of triggers sends one request,
 *   and never starts two requests closer than `minIntervalMs`.
 * - A new request aborts the one in flight.
 * - Only the latest attempt's result is delivered, so a slow old response
 *   can never overwrite a newer route.
 */
export interface RerouteController {
  request(build: () => RouteRequest): void;
  /** Drops any pending or in-flight request. Safe to call repeatedly. */
  cancel(): void;
  readonly isBusy: boolean;
}

/** Creates a {@linkcode RerouteController}. */
export function createRerouteController(options: {
  readonly provider: RouteProvider;
  readonly config: NavigationConfig['reroute'];
  readonly callbacks: RerouteCallbacks;
  readonly now: () => number;
  readonly schedule?: ScheduleFn;
}): RerouteController {
  const { provider, config, callbacks, now } = options;
  const schedule = options.schedule ?? defaultSchedule;
  let attempt = 0;
  let cancelTimer: (() => void) | undefined;
  let inFlight: AbortController | undefined;
  let lastStartMs: number | undefined;
  let pendingBuild: (() => RouteRequest) | undefined;

  const start = () => {
    cancelTimer = undefined;
    const build = pendingBuild;
    pendingBuild = undefined;
    if (!build) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    attempt += 1;
    const mine = attempt;
    lastStartMs = now();
    callbacks.onStart(mine);
    let request: RouteRequest;
    try {
      request = build();
    } catch (error) {
      inFlight = undefined;
      callbacks.onFailure(
        new RouteProviderError('invalid-request', provider.id, error instanceof Error ? error.message : 'invalid reroute request'),
        mine,
      );
      return;
    }
    provider.getRoutes(request, { signal: controller.signal }).then(
      (response) => {
        if (mine !== attempt || controller.signal.aborted) return;
        inFlight = undefined;
        callbacks.onResponse(response, mine);
      },
      (error: unknown) => {
        if (mine !== attempt || controller.signal.aborted || isAbortError(error)) return;
        inFlight = undefined;
        callbacks.onFailure(
          error instanceof RouteProviderError
            ? error
            : new RouteProviderError('unavailable', provider.id, error instanceof Error ? error.message : 'reroute failed'),
          mine,
        );
      },
    );
  };

  return {
    get isBusy() {
      return cancelTimer !== undefined || inFlight !== undefined;
    },
    request(build) {
      pendingBuild = build;
      if (cancelTimer) return; // already waiting; the latest builder wins
      const sinceLast = lastStartMs === undefined ? Number.POSITIVE_INFINITY : now() - lastStartMs;
      const delay = Math.max(config.debounceMs, config.minIntervalMs - sinceLast);
      cancelTimer = schedule(start, delay);
    },
    cancel() {
      cancelTimer?.();
      cancelTimer = undefined;
      pendingBuild = undefined;
      inFlight?.abort();
      inFlight = undefined;
      attempt += 1; // invalidates anything still settling
    },
  };
}
