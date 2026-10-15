'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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
import { useExplore } from './explore.store';
import { usePlaceCatalogue } from './place-catalogue.store.ts';
import { useExploreType } from './explore-type';
import type { ExploreMapProps, MapInsets } from './ExploreMap.types.ts';
import { ExploreSchematicMap } from './ExploreSchematicMap';
import { getNativeMap, type NativeMapModule, type NativeMapStyle, type NativeMapViewRef } from './native-map-module.ts';
import { useNativeMap } from './native-map.store.ts';
import { navigationFixStore, useNavigationStore } from '../navigation/session/navigationStore';
import { selectDisplayedRoute, splitRouteAt, toLngLat } from '../navigation/view/routeLine';
import type { GeographicCoordinate } from '../navigation/model/geo';

/** First frame before the fit: central Harlem, so the map never opens on the globe. */
const START_CAMERA = { center: { latitude: 40.8089, longitude: -73.9482 }, zoom: 14 };

type MapAttachment = { map: NativeMapViewRef; disposed: boolean };
type MapStyleLoad = {
  isCurrent: () => boolean;
  writeSource: (id: string, data: string) => void;
};

/** Optional camera/query work may fail without making the map unusable. */
const quiet = (operation: () => Promise<unknown>) => {
  try { void operation().catch(() => {}); } catch { /* A native bridge may throw synchronously. */ }
};

/**
 * Explore's map on phones, foldables and Quest: Mapbox Maps SDK v11 through
 * `MapboxMapView` (docs/adr/0007-native-mapbox-map-mobile.md).
 *
 * The schematic stays the fallback, used only when this build did not
 * register the native view (a build without the library or public token)
 * or required map layers/data could not be loaded or updated.
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
  const catalogue = usePlaceCatalogue((s) => s.places);
  const byId = useMemo(() => new Map(catalogue.map((p) => [p.id, p])), [catalogue]);
  const mapPoints = useMemo(() => catalogue.flatMap((p): MapPlacePoint[] =>
    p.lngLat ? [{ id: p.id, name: p.name, lngLat: p.lngLat }] : []), [catalogue]);
  const placeBounds = useMemo(() => boundsOf(mapPoints.map((p) => p.lngLat)), [mapPoints]);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const showUserLocation = useNativeMap((s) => s.showUserLocation);
  const locationDenied = useNativeMap((s) => s.locationDenied);
  const reduceMotion = useReducedMotion();
  // Style loaded and Explore's layers are on it; read from the store, not React state.
  const ready = useNativeMap((s) => s.status === 'ready');

  const styleRef = useRef<MapStyleLoad | null>(null);
  const attachmentRef = useRef<MapAttachment | null>(null);
  const locationRequestRef = useRef<{ attachment: MapAttachment } | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const latest = useRef({ onSelectPlace, insets, selectedPlaceId, reduceMotion, mapPoints, byId, placeBounds });
  useEffect(() => {
    latest.current = { onSelectPlace, insets, selectedPlaceId, reduceMotion, mapPoints, byId, placeBounds };
  });

  const link = useRef<{
    map: NativeMapViewRef | null;
    connect: ((map: NativeMapViewRef | null) => void) | null;
  }>({ map: null, connect: null });
  const receiveMap = useCallback((map: NativeMapViewRef | null) => {
    link.current.map = map;
    link.current.connect?.(map);
  }, []);
  // Nitro callback only wraps the function in { f }; native invokes it after commit.
  // eslint-disable-next-line react-hooks/refs -- verified callback wrapper does not execute receiveMap
  const hybridRef = useMemo(() => native.callback(receiveMap), [native, receiveMap]);

  useEffect(() => {
    return () => {
      // The OS permission can change while Explore is closed; ask again next time.
      useNativeMap.getState().setShowUserLocation(false);
    };
  }, []);

  // Listeners attach as soon as the view hands over its ref (hybridRef above),
  // before its first style finishes loading.
  useLayoutEffect(() => {
    useNativeMap.getState().setStatus('loading');
    let cancelled = false;
    let detach: (() => void) | null = null;

    const attach = (map: NativeMapViewRef) => {
      // A native view can be replaced without replaying this effect. Pending
      // work belongs to this attachment, even if the same view later returns.
      const attachment = { map, disposed: false };
      attachmentRef.current = attachment;
      const isAttached = () => !attachment.disposed && attachmentRef.current === attachment && useNativeMap.getState().status !== 'failed';
      let routeKey = '';
      let routeCoordinates: readonly GeographicCoordinate[] = [];

      const durationMs = (ms: number) => (latest.current.reduceMotion ? 0 : ms);

      const frameCatalogue = () => {
        const bounds = latest.current.placeBounds;
        if (!bounds) return;
        quiet(() =>
          map.fitBounds(bounds, {
            padding: framePadding(latest.current.insets, sizeRef.current, FIT_PADDING),
            maxZoom: FIT_MAX_ZOOM,
            pitchDeg: BUILDING_PITCH,
            bearingDeg: BUILDING_BEARING,
            durationMs: 0,
          }),
        );
      };

      const drawRoute = (load: MapStyleLoad) => {
        const state = useNavigationStore.getState();
        const displayed = selectDisplayedRoute(state);
        const key = displayed ? `${displayed.route.id}:${displayed.generation}:${displayed.kind}` : '';
        if (key === routeKey) return;
        routeKey = key;
        routeCoordinates = displayed?.route.geometry.coordinates ?? [];
        load.writeSource(ROUTE_WALKED_SOURCE, lineGeoJson([]));
        load.writeSource(ROUTE_AHEAD_SOURCE, lineGeoJson(toLngLat(routeCoordinates)));
        const session = state.session;
        load.writeSource(
          ROUTE_ALTERNATIVES_SOURCE,
          linesGeoJson(
            session.phase === 'routeReady'
              ? session.routes
                  .filter((_, i) => i !== session.selectedRouteIndex)
                  .map((r) => toLngLat(r.geometry.coordinates))
              : [],
          ),
        );
        if (!load.isCurrent()) return;
        const bounds = boundsOf(toLngLat(routeCoordinates));
        // Frame a new preview or a reroute inside what the panes leave visible.
        if (displayed && bounds && (displayed.kind === 'preview' || displayed.generation > 1)) {
          quiet(() =>
            map.fitBounds(bounds, {
              padding: framePadding(latest.current.insets, sizeRef.current, ROUTE_FIT_PADDING),
              maxZoom: ROUTE_MAX_ZOOM,
              durationMs: durationMs(600),
            }),
          );
        }
      };

      // The walked part dims as fixes match the active route.
      const drawFix = (load: MapStyleLoad) => {
        if (!routeKey.endsWith(':active')) return;
        const match = navigationFixStore.getState().match;
        if (match?.kind !== 'matched') return;
        const split = splitRouteAt(routeCoordinates, match);
        load.writeSource(ROUTE_WALKED_SOURCE, lineGeoJson(toLngLat(split.walked)));
        load.writeSource(ROUTE_AHEAD_SOURCE, lineGeoJson(toLngLat(split.ahead)));
      };

      // Sources and layers belong to one style; a reload drops them, so the
      // whole set is added again on every style load.
      // The style is published to styleRef only once its sources exist, so a
      // session change mid-setup cannot write to sources that are not there.
      let pendingStyle: MapStyleLoad | null = null;
      let framed = false;
      const setUpStyle = async (style: NativeMapStyle) => {
        if (!isAttached()) return;
        // Native may reuse the style object on reload; the load, not that
        // object's identity, owns setup and every source write.
        const updates = new Map<string, object>();
        const isCurrent = () => isAttached() && pendingStyle === load;
        const fail = (error: unknown) => {
          if (!isCurrent()) return;
          pendingStyle = null;
          styleRef.current = null;
          useNativeMap.getState().setStatus('failed', error instanceof Error ? error.message : String(error));
        };
        const load: MapStyleLoad = {
          isCurrent,
          writeSource(id, data) {
            if (!isCurrent()) return;
            const update = {};
            updates.set(id, update);
            const onError = (error: unknown) => {
              // A newer value for this source supersedes the older request.
              if (updates.get(id) === update) fail(error);
            };
            try { void style.setGeoJsonSourceData(id, data).catch(onError); } catch (error) { onError(error); }
          },
        };
        pendingStyle = load;
        styleRef.current = null;
        useNativeMap.getState().setStatus('loading');
        // The basemap look is cosmetic: a library build without `theme`
        // support still gets the layers, just in Standard's default colours.
        try { await style.setStandardConfig(EXPLORE_MAP_STANDARD_CONFIG); } catch { /* Cosmetic only. */ }
        if (!isCurrent()) return;
        try {
          await style.addGeoJsonSource({ id: PLACES_SOURCE, data: placesGeoJson(latest.current.mapPoints) });
          if (!isCurrent()) return;
          await style.addGeoJsonSource({
            id: SELECTED_SOURCE,
            data: selectedGeoJson(latest.current.mapPoints.find((p) => p.id === latest.current.selectedPlaceId) ?? null),
          });
          for (const id of [ROUTE_ALTERNATIVES_SOURCE, ROUTE_AHEAD_SOURCE, ROUTE_WALKED_SOURCE]) {
            if (!isCurrent()) return;
            await style.addGeoJsonSource({ id, data: lineGeoJson([]) });
          }
          for (const layer of PLACE_LAYERS) {
            if (!isCurrent()) return;
            await style.addLayer(layer);
          }
          for (const layer of ROUTE_LAYERS) {
            if (!isCurrent()) return;
            await style.addLayer(layer, DOTS_LAYER);
          }
        } catch (error) {
          fail(error);
          return;
        }
        if (!isCurrent()) return;
        styleRef.current = load;
        routeKey = '';
        // Catalogue/selection can change while their initial source is being
        // installed. Reconcile the latest values even if React batches readiness.
        load.writeSource(PLACES_SOURCE, placesGeoJson(latest.current.mapPoints));
        load.writeSource(SELECTED_SOURCE, selectedGeoJson(latest.current.mapPoints.find((p) => p.id === latest.current.selectedPlaceId) ?? null));
        drawRoute(load);
        drawFix(load);
        if (!isCurrent()) return;
        useNativeMap.getState().setStatus('ready');
        // Frame the catalogue once; a later style reload keeps the person's camera.
        if (!framed && !routeKey && !latest.current.selectedPlaceId) frameCatalogue();
        framed = true;
      };

      let styleSeen = false;
      // Listener methods take plain functions; only view props need callback().
      const subscriptions = [
        map.addOnStyleLoadedListener((style) => {
          if (!isAttached()) return;
          styleSeen = true;
          void setUpStyle(style);
        }),
        map.addOnMapLoadingErrorListener((error) => {
          // Only a map that never got a style falls back (no token, style
          // unreachable). A missing tile, sprite or glyph later is not fatal.
          if (!styleSeen && isAttached()) useNativeMap.getState().setStatus('failed', error.message);
        }),
        map.addOnMapTapListener((event) => {
          if (!isAttached() || sizeRef.current.width === 0 || sizeRef.current.height === 0) return;
          quiet(() =>
            map
              .queryRenderedFeatures({ area: tapBox(event.point, sizeRef.current), layerIds: TAPPABLE_LAYERS })
              .then((features) => {
                if (!isAttached()) return;
                const id = features.map((f) => placeIdFromFeature(f.toGeoJson())).find(Boolean);
                const place = id ? latest.current.byId.get(id) : undefined;
                if (place) latest.current.onSelectPlace(place);
              }),
          );
        }),
      ];
      const unsubSession = useNavigationStore.subscribe((state, prev) => {
        if (!isAttached()) return;
        const style = styleRef.current;
        if (style && state.session !== prev.session) {
          drawRoute(style);
          drawFix(style);
        }
      });
      const unsubFix = navigationFixStore.subscribe(() => {
        if (!isAttached()) return;
        if (styleRef.current) drawFix(styleRef.current);
      });

      return () => {
        attachment.disposed = true;
        if (locationRequestRef.current?.attachment === attachment) locationRequestRef.current = null;
        pendingStyle = null;
        subscriptions.forEach((s) => s.remove());
        unsubSession();
        unsubFix();
      };
    };

    let attached: NativeMapViewRef | null = null;
    // A remounted view hands over a new ref; move the listeners to it.
    const connect = (map: NativeMapViewRef | null) => {
      if (cancelled || attached === map || (map && useNativeMap.getState().status === 'failed')) return;
      detach?.();
      detach = null;
      attached = map;
      attachmentRef.current = null;
      styleRef.current = null;
      if (map) {
        useNativeMap.getState().setStatus('loading');
        detach = attach(map);
      } else if (useNativeMap.getState().status !== 'failed') {
        useNativeMap.getState().setStatus('off');
      }
    };
    const connection = link.current;
    connection.connect = connect;
    if (connection.map) connect(connection.map);

    return () => {
      cancelled = true;
      // Effect replay keeps the same mounted native view. Keep its ref so
      // listeners can reconnect; a new component instance owns a fresh ref.
      connection.connect = null;
      if (useNativeMap.getState().status !== 'failed') useNativeMap.getState().setStatus('off');
      detach?.();
      styleRef.current = null;
      attachmentRef.current = null;
    };
  }, [native]);

  // Selection: redraw the selected marker and fly to it inside the visible part.
  const insetsKey = `${insets.top}:${insets.right}:${insets.bottom}:${insets.left}`;
  useEffect(() => {
    const style = styleRef.current;
    const attachment = attachmentRef.current;
    const map = attachment?.map;
    if (!ready || !style || !map) return;
    const place = mapPoints.find((p) => p.id === selectedPlaceId) ?? null;
    style.writeSource(SELECTED_SOURCE, selectedGeoJson(place));
    if (!place || !style.isCurrent()) return;
    let cancelled = false;
    quiet(() =>
      map.getCameraState().then((camera) => {
        if (cancelled || !style.isCurrent()) return;
        return map.flyTo(
          {
            center: { latitude: place.lngLat[1], longitude: place.lngLat[0] },
            zoom: Math.max(camera.zoom, SELECT_MIN_ZOOM),
            pitchDeg: BUILDING_PITCH,
            bearingDeg: BUILDING_BEARING,
            padding: framePadding(latest.current.insets, sizeRef.current, 0),
          },
          { durationMs: latest.current.reduceMotion ? 0 : 900 },
        );
      }),
    );
    return () => { cancelled = true; };
    // insetsKey: a drawer or Detail opening moves the visible part; re-centre in it.
  }, [ready, selectedPlaceId, insetsKey, mapPoints]);

  // Catalogue reads finish independently of the map style. Update its source
  // without remounting the native view or losing its listeners/camera.
  useEffect(() => {
    const style = styleRef.current;
    const map = attachmentRef.current?.map;
    if (!ready || !style || !map) return;
    style.writeSource(PLACES_SOURCE, placesGeoJson(mapPoints));
    if (!style.isCurrent()) return;
    if (placeBounds && !latest.current.selectedPlaceId) {
      quiet(() => map.fitBounds(placeBounds, {
        padding: framePadding(latest.current.insets, sizeRef.current, FIT_PADDING),
        maxZoom: FIT_MAX_ZOOM, pitchDeg: BUILDING_PITCH, bearingDeg: BUILDING_BEARING, durationMs: 0,
      }));
    }
  }, [ready, mapPoints, placeBounds]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    sizeRef.current = { width, height };
  };

  const toggleLocation = async () => {
    const attachment = attachmentRef.current;
    const state = useNativeMap.getState();
    if (!attachment || attachment.disposed || state.status === 'off' || state.status === 'failed') return;
    // Another press may arrive before React renders the last store update.
    if (state.showUserLocation) {
      locationRequestRef.current = null;
      state.setShowUserLocation(false);
      return;
    }
    // Repeated taps share this attachment's pending OS prompt.
    if (locationRequestRef.current?.attachment === attachment) return;
    const request = { attachment };
    locationRequestRef.current = request;
    const isCurrent = () => {
      const status = useNativeMap.getState().status;
      return locationRequestRef.current === request && attachmentRef.current === attachment &&
        !attachment.disposed && status !== 'off' && status !== 'failed';
    };
    try {
      // iOS: the Maps SDK shows the system prompt itself the first time the puck
      // turns on (NSLocationWhenInUseUsageDescription is in Info.plist).
      // Android has no such prompt, so the app asks here.
      if (Platform.OS === 'android') {
        // Android 12+ lets the person pick "Approximate", which grants only
        // COARSE. The puck works with either.
        const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } = PermissionsAndroid.PERMISSIONS;
        const result = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
        if (!isCurrent()) return;
        const granted = PermissionsAndroid.RESULTS.GRANTED;
        if (result[FINE] !== granted && result[COARSE] !== granted) {
          useNativeMap.getState().setLocationDenied(true);
          return;
        }
      }
      if (isCurrent()) useNativeMap.getState().setShowUserLocation(true);
    } catch {
      // A bridge failure is not an OS denial. Keep the puck off and allow retry;
      // the void button callback must never leak a rejected permission promise.
    } finally {
      // A stale completion must not unlock a replacement attachment's request.
      if (locationRequestRef.current === request) locationRequestRef.current = null;
    }
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
