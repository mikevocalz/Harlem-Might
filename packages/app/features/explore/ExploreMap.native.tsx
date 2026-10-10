'use client';

import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, type LayoutChangeEvent } from 'react-native';
import { useReducedMotion } from '@acme/ui';
import { MightsButton } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import {
  BUILDING_BEARING,
  BUILDING_PITCH,
  DOTS_LAYER,
  EXPLORE_MAP_STANDARD_CONFIG,
  EXPLORE_MAP_STYLE_URI,
  FIT_MAX_ZOOM,
  FIT_PADDING,
  PLACE_LAYERS,
  PLACES_SOURCE,
  ROUTE_AHEAD_SOURCE,
  ROUTE_ALTERNATIVES_SOURCE,
  ROUTE_FIT_PADDING,
  ROUTE_LAYERS,
  ROUTE_MAX_ZOOM,
  ROUTE_WALKED_SOURCE,
  SELECT_MIN_ZOOM,
  SELECTED_SOURCE,
  TAPPABLE_LAYERS,
  boundsOf,
  framePadding,
  lineGeoJson,
  linesGeoJson,
  placeIdFromFeature,
  placesGeoJson,
  selectedGeoJson,
  tapBox,
  type MapPlacePoint,
} from './explore-map-layers.ts';
import { HARLEM_PLACE_PREVIEWS, useExplore } from './explore.store';
import { useExploreType } from './explore-type';
import type { ExploreMapProps, MapInsets } from './ExploreMap.types.ts';
import { ExploreSchematicMap } from './ExploreSchematicMap';
import { getNativeMap, type NativeMapModule, type NativeMapStyle, type NativeMapViewRef } from './native-map-module.ts';
import { useNativeMap } from './native-map.store.ts';
import { navigationFixStore, useNavigationStore } from '../navigation/session/navigationStore';
import { selectDisplayedRoute, splitRouteAt, toLngLat } from '../navigation/view/routeLine';
import type { GeographicCoordinate } from '../navigation/model/geo';

const byId = new Map(HARLEM_PLACE_PREVIEWS.map((place) => [place.id, place]));
const MAP_POINTS: MapPlacePoint[] = HARLEM_PLACE_PREVIEWS.flatMap((p) =>
  p.lngLat ? [{ id: p.id, name: p.name, lngLat: p.lngLat }] : [],
);
const PLACE_BOUNDS = boundsOf(MAP_POINTS.map((p) => p.lngLat));
const pointFor = (id: string | null) => (id ? (MAP_POINTS.find((p) => p.id === id) ?? null) : null);

/** First frame before the fit: central Harlem, so the map never opens on the globe. */
const START_CAMERA = { center: { latitude: 40.8089, longitude: -73.9482 }, zoom: 14 };

/**
 * The mounted view's ref and the effect waiting for it. Module scope, not
 * React state: Explore mounts one map at a time, the ref handler fires
 * outside render, and the effects below are the only readers.
 */
const link: {
  map: NativeMapViewRef | null;
  connect: ((map: NativeMapViewRef) => void) | null;
} = { map: null, connect: null };

let wrappedRef: { native: NativeMapModule; ref: unknown } | null = null;

/**
 * Nitro needs every function prop wrapped by its callback(). Built once per
 * module, so the view never sees a new ref handler.
 */
function hybridRefFor(native: NativeMapModule): unknown {
  if (wrappedRef?.native !== native) {
    wrappedRef = {
      native,
      ref: native.callback((ref: NativeMapViewRef | null) => {
        link.map = ref;
        if (ref) link.connect?.(ref);
      }),
    };
  }
  return wrappedRef.ref;
}

/** Promises from a stale style or a map mid-teardown reject; nothing to do about it. */
const quiet = (promise: Promise<unknown>) => {
  promise.catch(() => {});
};

/**
 * Explore's map on phones and foldables: Mapbox Maps SDK v11 through
 * `MapboxMapView` (docs/adr/0007-native-mapbox-map-mobile.md).
 *
 * The schematic stays the fallback, used only when this build did not
 * register the native view (the headset build, or a build without the
 * library) or the map reported a loading error.
 */
export function ExploreMap(props: ExploreMapProps) {
  const native = getNativeMap();
  const status = useNativeMap((s) => s.status);
  if (!native || status === 'failed') return <ExploreSchematicMap {...props} />;
  return <NativeExploreMap native={native} {...props} />;
}

/**
 * The view is driven imperatively through `hybridRef`, like the site's GL JS
 * map: one style setup per style load, store subscriptions for the route and
 * the walked part, effects for selection and framing. Places are a GeoJSON
 * source drawn as circle and symbol layers; a tap queries those layers.
 */
function NativeExploreMap({ native, onSelectPlace, insets }: ExploreMapProps & { native: NativeMapModule }) {
  const type = useExploreType();
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const showUserLocation = useNativeMap((s) => s.showUserLocation);
  const locationDenied = useNativeMap((s) => s.locationDenied);
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);

  const styleRef = useRef<NativeMapStyle | null>(null);
  const mapRef = useRef<NativeMapViewRef | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const latest = useRef({ onSelectPlace, insets, selectedPlaceId, reduceMotion });
  useEffect(() => {
    latest.current = { onSelectPlace, insets, selectedPlaceId, reduceMotion };
  });

  const hybridRef = hybridRefFor(native);

  useEffect(() => {
    const { setStatus } = useNativeMap.getState();
    setStatus('loading');
    return () => {
      // Back to "off" unless the map failed: a failed map leaves the schematic
      // and its retry note in place.
      if (useNativeMap.getState().status !== 'failed') setStatus('off');
      // The OS permission can change while Explore is closed; ask again next time.
      useNativeMap.getState().setShowUserLocation(false);
    };
  }, []);

  // Listeners attach as soon as the view hands over its ref (hybridRef above),
  // before its first style finishes loading.
  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | null = null;

    const attach = (map: NativeMapViewRef) => {
      let routeKey = '';
      let routeCoordinates: readonly GeographicCoordinate[] = [];

      const durationMs = (ms: number) => (latest.current.reduceMotion ? 0 : ms);

      const frameCatalogue = () => {
        if (!PLACE_BOUNDS) return;
        quiet(
          map.fitBounds(PLACE_BOUNDS, {
            padding: framePadding(latest.current.insets, sizeRef.current, FIT_PADDING),
            maxZoom: FIT_MAX_ZOOM,
            pitchDeg: BUILDING_PITCH,
            bearingDeg: BUILDING_BEARING,
            durationMs: 0,
          }),
        );
      };

      const drawRoute = (style: NativeMapStyle) => {
        const state = useNavigationStore.getState();
        const displayed = selectDisplayedRoute(state);
        const key = displayed ? `${displayed.route.id}:${displayed.generation}:${displayed.kind}` : '';
        if (key === routeKey) return;
        routeKey = key;
        routeCoordinates = displayed?.route.geometry.coordinates ?? [];
        quiet(style.setGeoJsonSourceData(ROUTE_WALKED_SOURCE, lineGeoJson([])));
        quiet(style.setGeoJsonSourceData(ROUTE_AHEAD_SOURCE, lineGeoJson(toLngLat(routeCoordinates))));
        const session = state.session;
        quiet(
          style.setGeoJsonSourceData(
            ROUTE_ALTERNATIVES_SOURCE,
            linesGeoJson(
              session.phase === 'routeReady'
                ? session.routes
                    .filter((_, i) => i !== session.selectedRouteIndex)
                    .map((r) => toLngLat(r.geometry.coordinates))
                : [],
            ),
          ),
        );
        const bounds = boundsOf(toLngLat(routeCoordinates));
        // Frame a new preview or a reroute inside what the panes leave visible.
        if (displayed && bounds && (displayed.kind === 'preview' || displayed.generation > 1)) {
          quiet(
            map.fitBounds(bounds, {
              padding: framePadding(latest.current.insets, sizeRef.current, ROUTE_FIT_PADDING),
              maxZoom: ROUTE_MAX_ZOOM,
              durationMs: durationMs(600),
            }),
          );
        }
      };

      // The walked part dims as fixes match the active route.
      const drawFix = (style: NativeMapStyle) => {
        if (!routeKey.endsWith(':active')) return;
        const match = navigationFixStore.getState().match;
        if (match?.kind !== 'matched') return;
        const split = splitRouteAt(routeCoordinates, match);
        quiet(style.setGeoJsonSourceData(ROUTE_WALKED_SOURCE, lineGeoJson(toLngLat(split.walked))));
        quiet(style.setGeoJsonSourceData(ROUTE_AHEAD_SOURCE, lineGeoJson(toLngLat(split.ahead))));
      };

      // Sources and layers belong to one style; a reload drops them, so the
      // whole set is added again on every style load.
      // The style is published to styleRef only once its sources exist, so a
      // session change mid-setup cannot write to sources that are not there.
      let pendingStyle: NativeMapStyle | null = null;
      let framed = false;
      const setUpStyle = async (style: NativeMapStyle) => {
        pendingStyle = style;
        styleRef.current = null;
        // The basemap look is cosmetic: a library build without `theme`
        // support still gets the layers, just in Standard's default colours.
        await style.setStandardConfig(EXPLORE_MAP_STANDARD_CONFIG).catch(() => {});
        try {
          await style.addGeoJsonSource({ id: PLACES_SOURCE, data: placesGeoJson(MAP_POINTS) });
          await style.addGeoJsonSource({
            id: SELECTED_SOURCE,
            data: selectedGeoJson(pointFor(latest.current.selectedPlaceId)),
          });
          for (const id of [ROUTE_ALTERNATIVES_SOURCE, ROUTE_AHEAD_SOURCE, ROUTE_WALKED_SOURCE]) {
            await style.addGeoJsonSource({ id, data: lineGeoJson([]) });
          }
          for (const layer of PLACE_LAYERS) await style.addLayer(layer);
          for (const layer of ROUTE_LAYERS) await style.addLayer(layer, DOTS_LAYER);
        } catch (error) {
          if (cancelled || pendingStyle !== style) return; // superseded by a newer style
          useNativeMap.getState().setStatus('failed', error instanceof Error ? error.message : String(error));
          return;
        }
        if (cancelled || pendingStyle !== style) return;
        styleRef.current = style;
        routeKey = '';
        useNativeMap.getState().setStatus('ready');
        setReady(true);
        drawRoute(style);
        drawFix(style);
        // Frame the catalogue once; a later style reload keeps the person's camera.
        if (!framed && !routeKey && !latest.current.selectedPlaceId) frameCatalogue();
        framed = true;
      };

      let styleSeen = false;
      // Listener methods take plain functions; only view props need callback().
      const subscriptions = [
        map.addOnStyleLoadedListener((style) => {
          styleSeen = true;
          void setUpStyle(style);
        }),
        map.addOnMapLoadingErrorListener((error) => {
          // Only a map that never got a style falls back (no token, style
          // unreachable). A missing tile, sprite or glyph later is not fatal.
          if (!styleSeen && !cancelled) useNativeMap.getState().setStatus('failed', error.message);
        }),
        map.addOnMapTapListener((event) => {
          if (sizeRef.current.width === 0 || sizeRef.current.height === 0) return;
          quiet(
            map
              .queryRenderedFeatures({ area: tapBox(event.point, sizeRef.current), layerIds: TAPPABLE_LAYERS })
              .then((features) => {
                const id = features.map((f) => placeIdFromFeature(f.toGeoJson())).find(Boolean);
                const place = id ? byId.get(id) : undefined;
                if (place) latest.current.onSelectPlace(place);
              }),
          );
        }),
      ];
      const unsubSession = useNavigationStore.subscribe((state, prev) => {
        const style = styleRef.current;
        if (style && state.session !== prev.session) {
          drawRoute(style);
          drawFix(style);
        }
      });
      const unsubFix = navigationFixStore.subscribe(() => {
        if (styleRef.current) drawFix(styleRef.current);
      });

      return () => {
        subscriptions.forEach((s) => s.remove());
        unsubSession();
        unsubFix();
      };
    };

    let attached: NativeMapViewRef | null = null;
    // A remounted view hands over a new ref; move the listeners to it.
    const connect = (map: NativeMapViewRef) => {
      if (cancelled || attached === map) return;
      detach?.();
      attached = map;
      mapRef.current = map;
      styleRef.current = null;
      detach = attach(map);
    };
    link.connect = connect;
    if (link.map) connect(link.map);

    return () => {
      cancelled = true;
      // A later mount gets a new view and a new ref; never let it attach to
      // this one. (A Fast Refresh that re-runs this effect without remounting
      // the view loses the listeners until the next reload. Dev only.)
      link.connect = null;
      link.map = null;
      detach?.();
      styleRef.current = null;
      mapRef.current = null;
    };
  }, [native]);

  // Selection: redraw the selected marker and fly to it inside the visible part.
  const insetsKey = `${insets.top}:${insets.right}:${insets.bottom}:${insets.left}`;
  useEffect(() => {
    const style = styleRef.current;
    const map = mapRef.current;
    if (!ready || !style || !map) return;
    const place = pointFor(selectedPlaceId);
    quiet(style.setGeoJsonSourceData(SELECTED_SOURCE, selectedGeoJson(place)));
    if (!place) return;
    quiet(
      map.getCameraState().then((camera) =>
        map.flyTo(
          {
            center: { latitude: place.lngLat[1], longitude: place.lngLat[0] },
            zoom: Math.max(camera.zoom, SELECT_MIN_ZOOM),
            pitchDeg: BUILDING_PITCH,
            bearingDeg: BUILDING_BEARING,
            padding: framePadding(latest.current.insets, sizeRef.current, 0),
          },
          { durationMs: latest.current.reduceMotion ? 0 : 900 },
        ),
      ),
    );
    // insetsKey: a drawer or Detail opening moves the visible part; re-centre in it.
  }, [ready, selectedPlaceId, insetsKey]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    sizeRef.current = { width, height };
  };

  const toggleLocation = async () => {
    const { setShowUserLocation, setLocationDenied } = useNativeMap.getState();
    if (showUserLocation) {
      setShowUserLocation(false);
      return;
    }
    // iOS: the Maps SDK shows the system prompt itself the first time the puck
    // turns on (NSLocationWhenInUseUsageDescription is in Info.plist).
    // Android has no such prompt, so the app asks here.
    if (Platform.OS === 'android') {
      // Android 12+ lets the person pick "Approximate", which grants only
      // COARSE. The puck works with either.
      const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } = PermissionsAndroid.PERMISSIONS;
      const result = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
      const granted = PermissionsAndroid.RESULTS.GRANTED;
      if (result[FINE] !== granted && result[COARSE] !== granted) {
        setLocationDenied(true);
        return;
      }
    }
    setShowUserLocation(true);
  };

  return (
    <View className="absolute inset-0" onLayout={onLayout}>
      <native.MapView
        style={{ flex: 1 }}
        styleUri={EXPLORE_MAP_STYLE_URI}
        camera={START_CAMERA}
        enableGestures
        showUserLocation={showUserLocation}
        puckBearing={showUserLocation ? 'heading' : 'none'}
        hybridRef={hybridRef as never}
        accessible
        accessibilityLabel="Street map of Harlem. Every place on it is also in the place list."
      />
      {native.supportsLocationPuck ? (
        <LocationToggle
          insets={insets}
          pressed={showUserLocation}
          denied={locationDenied}
          caption={type.caption}
          size={type.buttons.control}
          onPress={() => void toggleLocation()}
        />
      ) : null}
    </View>
  );
}

function LocationToggle({
  insets,
  pressed,
  denied,
  caption,
  size,
  onPress,
}: {
  insets: MapInsets;
  pressed: boolean;
  denied: boolean;
  caption: string;
  size: ReturnType<typeof useExploreType>['buttons']['control'];
  onPress: () => void;
}) {
  return (
    <View className="absolute top-4 items-end gap-1" style={{ right: insets.right + 16 }} pointerEvents="box-none">
      <MightsButton
        size={size}
        variant={pressed ? 'primary' : 'outline'}
        pressed={pressed}
        onPress={onPress}
        aria-label={pressed ? 'Hide my location' : 'Show my location on the map'}
      >
        My location
      </MightsButton>
      {denied ? (
        <Text className={caption + ' max-w-56 bg-surface-raised px-2 py-1 font-sans text-text'}>
          Location is off for Harlem Might. Turn it on in Settings to see yourself on the map.
        </Text>
      ) : null}
    </View>
  );
}
