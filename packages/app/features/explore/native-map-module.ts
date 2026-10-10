import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

/**
 * The slice of `@mikevocalz/nitro-mapbox-ar-maps` that Explore uses, typed
 * here so `packages/app` never imports the library.
 *
 * The library is a sibling checkout linked into `apps/mobile` only. CI has no
 * copy of it, and the quest build must not mount it, so the mobile app hands
 * the real module over at startup (`registerNativeMap`) and this package
 * reads it back. The shapes mirror the library's specs (PR #41 API); the
 * mobile app's typecheck compares the two where it registers the module.
 */

export interface NativeMapCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export interface NativeMapEdgeInsets {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface NativeMapCameraTarget {
  center?: NativeMapCoordinate;
  zoom?: number;
  bearingDeg?: number;
  pitchDeg?: number;
  padding?: NativeMapEdgeInsets;
}

export interface NativeMapFitBoundsOptions {
  durationMs?: number;
  padding?: NativeMapEdgeInsets;
  bearingDeg?: number;
  pitchDeg?: number;
  maxZoom?: number;
}

export interface NativeMapBounds {
  southwest: NativeMapCoordinate;
  northeast: NativeMapCoordinate;
}

export interface NativeMapLayer {
  id: string;
  type: 'line' | 'circle' | 'symbol';
  sourceId?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

export interface NativeMapStandardConfig {
  importId?: string;
  lightPreset?: 'dawn' | 'day' | 'dusk' | 'night';
  theme?: 'default' | 'faded' | 'monochrome';
  show3dObjects?: boolean;
  showPointOfInterestLabels?: boolean;
}

export interface NativeMapStyle {
  addGeoJsonSource(source: { id: string; data: string }): Promise<void>;
  setGeoJsonSourceData(sourceId: string, data: string): Promise<void>;
  addLayer(layer: NativeMapLayer, belowLayerId?: string): Promise<void>;
  setStandardConfig(config: NativeMapStandardConfig): Promise<void>;
}

export interface NativeMapSubscription {
  remove: () => void;
}

export interface NativeMapRenderedFeature {
  toGeoJson(): string;
}

export interface NativeMapScreenPoint {
  x: number;
  y: number;
}

/** What `hybridRef` hands back: the view's methods. */
export interface NativeMapViewRef {
  fitBounds(bounds: NativeMapBounds, options?: NativeMapFitBoundsOptions): Promise<unknown>;
  flyTo(target: NativeMapCameraTarget, options?: { durationMs?: number }): Promise<unknown>;
  getCameraState(): Promise<{ zoom: number }>;
  addOnStyleLoadedListener(listener: (style: NativeMapStyle) => void): NativeMapSubscription;
  addOnMapTapListener(
    listener: (event: { coordinate: NativeMapCoordinate; point: NativeMapScreenPoint }) => void,
  ): NativeMapSubscription;
  addOnMapLoadingErrorListener(listener: (error: Error) => void): NativeMapSubscription;
  queryRenderedFeatures(query: {
    area: { min: NativeMapScreenPoint; max: NativeMapScreenPoint };
    layerIds?: string[];
  }): Promise<NativeMapRenderedFeature[]>;
}

export interface NativeMapViewProps extends ViewProps {
  styleUri: string;
  camera?: NativeMapCameraTarget;
  enableGestures?: boolean;
  showUserLocation?: boolean;
  puckBearing?: 'heading' | 'course' | 'none';
  /**
   * What `callback(ref => …)` returned. Typed `never` because the library's
   * wrapper type does not exist here; pass the callback result `as never`.
   */
  hybridRef?: never;
}

export interface NativeMapModule {
  /** `MapboxMapView` from the library. */
  MapView: ComponentType<NativeMapViewProps>;
  /** Nitro's `callback()`, which every function prop of a hybrid view needs. */
  callback: <T extends (...args: never[]) => unknown>(fn: T) => unknown;
  /** `MapboxMaps.capabilities.supportsLocationPuck`. */
  supportsLocationPuck: boolean;
}

let registered: NativeMapModule | null = null;

/**
 * Called once by the mobile app at startup, and only on a build that links
 * the view and is not the headset build. Leaving it uncalled keeps Explore
 * on the schematic map.
 */
export function registerNativeMap(module: NativeMapModule): void {
  registered = module;
}

/** The registered map module, or null when Explore should draw the schematic. */
export function getNativeMap(): NativeMapModule | null {
  return registered;
}
