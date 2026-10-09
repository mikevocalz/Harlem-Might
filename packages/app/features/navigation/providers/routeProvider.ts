import type { RouteProviderId, RouteRequest, RouteResponse, TravelMode } from '../model/route.ts';
import type { RouteFailureKind } from '../model/session.ts';

/**
 * A routing backend. Implementations translate a provider-neutral
 * {@linkcode RouteRequest} into their API and back.
 *
 * - Resolve with `kind: 'routes'` when at least one route exists.
 * - Resolve with `kind: 'unsupported'` for a mode the provider cannot route
 *   (transit for every provider here). Never invent a route.
 * - Reject with {@linkcode RouteProviderError} for every failure, including
 *   cancellation (`kind: 'aborted'`).
 */
export interface RouteProvider {
  readonly id: RouteProviderId;
  /** Modes this provider computes routes for. */
  readonly supportedModes: readonly TravelMode[];
  getRoutes(request: RouteRequest, options?: { readonly signal?: AbortSignal }): Promise<RouteResponse>;
}

/** Failure kinds a provider can raise: every {@linkcode RouteFailureKind} plus cancellation. */
export type RouteProviderErrorKind = RouteFailureKind | 'aborted';

/**
 * A route request failed. `kind` is what callers branch on; `message` is for
 * logs and never contains an access token.
 */
export class RouteProviderError extends Error {
  readonly kind: RouteProviderErrorKind;
  readonly provider: RouteProviderId;
  readonly status?: number;

  constructor(kind: RouteProviderErrorKind, provider: RouteProviderId, message: string, status?: number) {
    super(message);
    this.name = 'RouteProviderError';
    this.kind = kind;
    this.provider = provider;
    if (status !== undefined) this.status = status;
  }
}

/** True for a {@linkcode RouteProviderError} with kind `aborted`, or a DOM AbortError. */
export function isAbortError(error: unknown): boolean {
  if (error instanceof RouteProviderError) return error.kind === 'aborted';
  return error instanceof Error && error.name === 'AbortError';
}
