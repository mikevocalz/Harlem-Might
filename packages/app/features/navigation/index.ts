export type { GeographicCoordinate, PositionAccuracy } from './model/geo.ts';
export { assertCoordinate, radius68From95 } from './model/geo.ts';
export type {
  EntrancePoint,
  ExternalMapsHandoff,
  ManeuverModifier,
  ManeuverType,
  NavigationManeuver,
  OriginBearing,
  Route,
  RouteDestination,
  RouteGeometry,
  RouteLeg,
  RouteProviderId,
  RouteRequest,
  RouteResponse,
  RouteStep,
  TravelMode,
} from './model/route.ts';
export { arrivalTarget, routeSteps } from './model/route.ts';
export type {
  ConfidenceLevel,
  FilteredPosition,
  HeadingEstimate,
  HeadingSample,
  HeadingSource,
  LocationFix,
  LocationSource,
  RouteMatch,
} from './model/location.ts';
export type { ArrivalState, PositioningState, RouteDeviation, RouteProgress } from './model/progress.ts';
export type {
  ActiveRoute,
  ActiveSession,
  ActiveTrip,
  ArTrackingState,
  NavigationError,
  NavigationOrigin,
  NavigationPhase,
  NavigationSession,
  PlannedTrip,
  RerouteStatus,
  ResumablePhase,
  RouteFailureKind,
} from './model/session.ts';
export { hasActiveTrip } from './model/session.ts';

export type { NavigationConfig, NavigationConfigOverrides } from './config.ts';
export { DEFAULT_NAVIGATION_CONFIG, resolveNavigationConfig } from './config.ts';

export type { LocalFrame, LocalPoint } from './geo/localFrame.ts';
export { createLocalFrame, distanceM } from './geo/localFrame.ts';
export { angleBetweenDegrees, normalizeDegrees, signedDeltaDegrees } from './geo/angles.ts';

export type { RouteProvider, RouteProviderErrorKind } from './providers/routeProvider.ts';
export { RouteProviderError, isAbortError } from './providers/routeProvider.ts';
export type { MapboxDirectionsOptions } from './providers/mapboxDirections.ts';
export { createMapboxDirectionsProvider, parseMapboxDirections } from './providers/mapboxDirections.ts';
export type { MapboxTokenState } from './providers/mapboxToken.ts';
export { mapboxTokenFromEnv, parseMapboxToken } from './providers/mapboxToken.ts';
export { buildExternalMapsHandoff } from './providers/externalMaps.ts';

export type { FixRejectionReason, FixResult, LocationPipeline } from './location/locationPipeline.ts';
export { createLocationPipeline } from './location/locationPipeline.ts';
export { HeadingSmoother } from './location/heading.ts';
export type { RouteMatcher } from './matching/routeMatcher.ts';
export { createRouteMatcher } from './matching/routeMatcher.ts';
export { computeRouteProgress, createStepIndex } from './progress/routeProgress.ts';
export { createOffRouteDetector } from './deviation/offRouteDetector.ts';
export { createArrivalDetector } from './arrival/arrivalDetector.ts';
export { createRerouteController } from './reroute/rerouteController.ts';

export type {
  NavigationFixState,
  NavigationState,
  ProgressState,
  RouteLoadingState,
} from './session/navigationStore.ts';
export {
  navigationFixStore,
  resetNavigationStores,
  selectActiveRoute,
  selectArTracking,
  selectDestination,
  selectNavigationError,
  selectPhase,
  selectPositioning,
  selectProgress,
  selectRouteLoading,
  selectSession,
  summarizeSession,
  useNavigationStore,
} from './session/navigationStore.ts';
export type { NavigationController, NavigationControllerOptions, PlanRouteInput } from './session/navigationController.ts';
export { createNavigationController } from './session/navigationController.ts';
