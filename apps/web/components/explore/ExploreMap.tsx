'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent, Marker, PaddingOptions } from 'mapbox-gl';
import { semantic } from '@acme/theme';
import { View } from '@acme/ui/tw';
import { MightsButton } from '@acme/ui/mights';
import { useIsGuiding } from '@acme/app/features/navigation/ui/hooks.ts';
import type { GeographicCoordinate } from '@acme/app/features/navigation/model/geo.ts';
import { navigationFixStore, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { selectDisplayedRoute, splitRouteAt, toLngLat } from '@acme/app/features/navigation/view/routeLine.ts';
import { focusId } from './explore-url';
import { useMapStatus } from './map-status';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Start the mapbox-gl chunk fetch at module evaluation, not inside the mount
// effect: the ~800 kB library is the first thing on the map's critical path,
// so it downloads while React hydrates instead of after it.
const mapboxglPromise = typeof window === 'undefined' ? null : import('mapbox-gl');

export interface MapPlace {
  id: string;
  name: string;
  lngLat: readonly [number, number];
  /** Curated landmark: gets a real button marker at any zoom. */
  featured?: boolean;
}

interface ExploreMapProps {
  places: readonly MapPlace[];
  /**
   * Ids of the places the current search and category match. Markers for the
   * rest are hidden, not removed, so filtering never rebuilds the map.
   */
  visibleIds: readonly string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * The sheet or inspector element. Whatever part of it overlaps the map is
   * read at selection time and becomes camera padding, so a selected marker
   * lands in the visible part of the map at every breakpoint and detent.
   */
  occluderRef: RefObject<HTMLElement | null>;
  /** Re-centres on the selection when it changes (the sheet detent). */
  layoutKey: string;
}

// Camera framing in map pixels. Not a layout token: it is how far the
// catalogue bounds sit from the canvas edge, and the zoom a selection opens at.
const FIT_PADDING = 96;
const FIT_MAX_ZOOM = 15.5;
const SELECT_MIN_ZOOM = 16.5;
const BUILDING_PITCH = 64;
const BUILDING_BEARING = -18;
// The catalogue is drawn as canvas circles — ~1.6k DOM buttons would be a
// wall of tab stops and layout work. Featured landmarks and the selected
// place still get real button markers, and every place is a row in the list.
const DOTS_LAYER = 'hm-place-dots';
const LABELS_LAYER = 'hm-place-labels';
const PLACES_SOURCE = 'hm-places';
type MapView = 'map' | 'tilt' | 'buildings';
const MAP_VIEWS: readonly { id: MapView; label: string }[] = [
  { id: 'map', label: '2D' },
  { id: 'tilt', label: 'Tilt' },
  { id: 'buildings', label: '3D buildings' },
];

// Marker look lives here as utilities rather than in globals.css, so every
// value is a token. The 44×44 button is the hit area (WCAG 2.5.8 goal); the
// diamond inside is the mark. Selection changes shape (size), adds a light
// ring and a name label, so it never depends on colour alone.
// outline-hidden zeroes Tailwind's outline-style variable, which
// focus-visible:outline-2 reads, so the focus state names the style itself.
const MARKER_CLASS =
  'group/marker grid size-11 cursor-pointer place-items-center bg-transparent outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary data-[selected=true]:z-(--z-raised)';
const DIAMOND_CLASS =
  'block size-3 rotate-45 bg-primary outline-2 outline-surface transition-[width,height] duration-fast motion-reduce:transition-none group-data-[selected=true]/marker:size-4.5 group-data-[selected=true]/marker:outline-text';
const LABEL_CLASS =
  'pointer-events-none absolute left-full top-1/2 ml-1 hidden -translate-y-1/2 whitespace-nowrap border-l-2 border-primary bg-surface-raised px-2 font-sans text-label font-semibold text-text group-data-[selected=true]/marker:block';

// Route line: gold like the AR chevrons, not the cyan `route` token, so map
// and AR read as one route (AR spec: gold/warm guidance). Dark only (S14).
const ROUTE_AHEAD = semantic.primary.dark;
const ROUTE_WALKED = semantic['rule-rail'].dark;
const ROUTE_CASING = semantic.surface.dark;
const ROUTE_FIT_PADDING = 64;
const FOLLOW_ZOOM = 17;
const PUCK_CLASS =
  'pointer-events-none block size-4 rounded-full border-[3px] border-primary bg-text shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]';

// The GeoJSON shape setData takes, written out so the app does not need @types/geojson.
interface LineFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}
const line = (coordinates: [number, number][]): LineFeature => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates },
});
const EMPTY: LineFeature = line([]);
const EMPTY_SET = { type: 'FeatureCollection' as const, features: [] as LineFeature[] };

interface PointFeature {
  type: 'Feature';
  properties: { id: string; name: string };
  geometry: { type: 'Point'; coordinates: [number, number] };
}
const placeFeature = (p: MapPlace): PointFeature => ({
  type: 'Feature',
  properties: { id: p.id, name: p.name },
  geometry: { type: 'Point', coordinates: [p.lngLat[0], p.lngLat[1]] },
});

function overlap(map: MapboxMap, occluder: HTMLElement | null): PaddingOptions {
  const pad = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!occluder) return pad;
  const m = map.getContainer().getBoundingClientRect();
  const o = occluder.getBoundingClientRect();
  const horizontal = Math.min(m.right, o.right) - Math.max(m.left, o.left);
  const vertical = Math.min(m.bottom, o.bottom) - Math.max(m.top, o.top);
  if (horizontal <= 0 || vertical <= 0) return pad; // docked beside the map, nothing hidden
  // A sheet across the full width covers the bottom; a narrower panel covers a side.
  if (horizontal >= m.width - 1) pad.bottom = Math.max(0, m.bottom - o.top);
  else pad.right = Math.max(0, m.right - o.left);
  return pad;
}

/**
 * Draws the shared navigation session on the map: the route line (preview
 * or active, redrawn when the route id or reroute generation changes), the
 * walked part dimmed, and a position puck from the per-fix store. Camera
 * follows the puck until the person drags the map; Recenter turns following
 * back on. Subscribes to the stores directly, so a GPS fix never re-renders
 * React. Returns its cleanup.
 */
function attachNavigation(
  map: MapboxMap,
  mapboxgl: typeof import('mapbox-gl').default,
  occluder: () => HTMLElement | null,
): () => void {
  map.addSource('hm-route-alternatives', { type: 'geojson', data: EMPTY_SET });
  map.addSource('hm-route-ahead', { type: 'geojson', data: EMPTY });
  map.addSource('hm-route-walked', { type: 'geojson', data: EMPTY });
  const lineLayout = { 'line-join': 'round', 'line-cap': 'round' } as const;
  // Alternatives under the chosen route, muted, while choosing (Mapbox
  // navigation patterns: main route bold, others quiet). Added last of the
  // map's layers, so every route line sits above the basemap's POIs.
  map.addLayer({ id: 'hm-route-alternatives', type: 'line', source: 'hm-route-alternatives', slot: 'top', layout: lineLayout, paint: { 'line-color': ROUTE_WALKED, 'line-width': 4, 'line-opacity': 0.8 } });
  map.addLayer({ id: 'hm-route-casing', type: 'line', source: 'hm-route-ahead', slot: 'top', layout: lineLayout, paint: { 'line-color': ROUTE_CASING, 'line-width': 9 } });
  map.addLayer({ id: 'hm-route-walked', type: 'line', source: 'hm-route-walked', slot: 'top', layout: lineLayout, paint: { 'line-color': ROUTE_WALKED, 'line-width': 5 } });
  map.addLayer({ id: 'hm-route-ahead', type: 'line', source: 'hm-route-ahead', slot: 'top', layout: lineLayout, paint: { 'line-color': ROUTE_AHEAD, 'line-width': 5 } });

  const puckEl = document.createElement('span');
  puckEl.className = PUCK_CLASS;
  puckEl.setAttribute('aria-hidden', 'true');
  const puck = new mapboxgl.Marker({ element: puckEl, anchor: 'center' });
  let puckShown = false;

  const ahead = () => map.getSource('hm-route-ahead') as GeoJSONSource | undefined;
  const alternatives = () => map.getSource('hm-route-alternatives') as GeoJSONSource | undefined;
  const walked = () => map.getSource('hm-route-walked') as GeoJSONSource | undefined;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let routeKey = '';
  let coordinates: readonly GeographicCoordinate[] = [];
  const drawRoute = () => {
    const displayed = selectDisplayedRoute(useNavigationStore.getState());
    const key = displayed ? `${displayed.route.id}:${displayed.generation}:${displayed.kind}` : '';
    if (key === routeKey) return;
    routeKey = key;
    coordinates = displayed?.route.geometry.coordinates ?? [];
    walked()?.setData(EMPTY);
    ahead()?.setData(displayed ? line(toLngLat(coordinates)) : EMPTY);
    const session = useNavigationStore.getState().session;
    alternatives()?.setData(
      session.phase === 'routeReady'
        ? {
            type: 'FeatureCollection',
            features: session.routes
              .filter((_, i) => i !== session.selectedRouteIndex)
              .map((r) => line(toLngLat(r.geometry.coordinates))),
          }
        : EMPTY_SET,
    );
    if (!displayed) {
      puck.remove();
      puckShown = false;
      return;
    }
    // Frame the whole route on a new preview or reroute, inside the part of
    // the map the sheet or inspector leaves visible.
    if (displayed.kind === 'preview' || displayed.generation > 1 || !useNavigationUi.getState().followUser) {
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((c) => bounds.extend([c.longitude, c.latitude]));
      map.resize();
      const pad = overlap(map, occluder());
      map.fitBounds(bounds, {
        padding: {
          top: (pad.top ?? 0) + ROUTE_FIT_PADDING,
          right: (pad.right ?? 0) + ROUTE_FIT_PADDING,
          bottom: (pad.bottom ?? 0) + ROUTE_FIT_PADDING,
          left: (pad.left ?? 0) + ROUTE_FIT_PADDING,
        },
        maxZoom: FOLLOW_ZOOM,
        duration: reduce() ? 0 : 600,
      });
    }
  };

  const drawFix = () => {
    if (!routeKey) return;
    const fixes = navigationFixStore.getState();
    const match = fixes.match?.kind === 'matched' ? fixes.match : undefined;
    const position = match?.coordinate ?? (fixes.lastFix?.kind === 'accepted' ? fixes.lastFix.filtered.coordinate : undefined);
    if (match && routeKey.endsWith(':active')) {
      const split = splitRouteAt(coordinates, match);
      walked()?.setData(line(toLngLat(split.walked)));
      ahead()?.setData(line(toLngLat(split.ahead)));
    }
    if (!position) return;
    puck.setLngLat([position.longitude, position.latitude]);
    if (!puckShown) {
      puck.addTo(map);
      puckShown = true;
    }
    if (routeKey.endsWith(':active') && useNavigationUi.getState().followUser) {
      const target = { center: [position.longitude, position.latitude] as [number, number], zoom: Math.max(map.getZoom(), FOLLOW_ZOOM), padding: overlap(map, occluder()) };
      if (reduce()) map.jumpTo(target);
      else map.easeTo({ ...target, duration: 400 });
    }
  };

  // A drag by the person (not a camera move of ours) stops following.
  const onDragStart = (event: { originalEvent?: unknown }) => {
    if (event.originalEvent) useNavigationUi.getState().setFollowUser(false);
  };
  map.on('dragstart', onDragStart);

  drawRoute();
  drawFix();
  const unsubSession = useNavigationStore.subscribe((state, prev) => {
    if (state.session !== prev.session) {
      drawRoute();
      drawFix();
    }
  });
  const unsubFix = navigationFixStore.subscribe(drawFix);
  const unsubFollow = useNavigationUi.subscribe((state, prev) => {
    if (state.followUser && !prev.followUser) drawFix();
  });

  return () => {
    unsubSession();
    unsubFix();
    unsubFollow();
    map.off('dragstart', onDragStart);
    puck.remove();
  };
}

// Mapbox GL JS v3, driven imperatively through refs: one map per mount,
// DOM-button markers, flyTo on selection (jumpTo under reduced motion).
export function ExploreMap({ places, visibleIds, selectedId, onSelect, occluderRef, layoutKey }: ExploreMapProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const mapboxglRef = useRef<typeof import('mapbox-gl').default | null>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  const visibleRef = useRef(visibleIds);
  // A primitive dependency for the visibility effect. `visibleIds` is a
  // memoised array, so the joined key only re-derives when the set changes —
  // not on every render of the workspace above it.
  const visibleKey = useMemo(() => visibleIds.join('\n'), [visibleIds]);
  const setStatus = useMapStatus((s) => s.setStatus);
  const detachNavigationRef = useRef<(() => void) | null>(null);
  const [mapView, setMapView] = useState<MapView>('buildings');
  const mapViewRef = useRef(mapView);
  const guiding = useIsGuiding();

  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedRef.current = selectedId;
    visibleRef.current = visibleIds;
    mapViewRef.current = mapView;
  }, [onSelect, selectedId, visibleIds, mapView]);

  // The selected marker stays visible even when the filter excludes it: the
  // open sheet points at it. The camera is never refitted to the filtered set;
  // q changes on every debounced keystroke, so a refit would make the map lurch
  // while typing, and the catalogue bounds already frame every marker.
  // el.hidden works over the marker's `grid` utility because preflight's
  // [hidden] rule is !important in an earlier layer, which wins.
  const applyVisibility = () => {
    const visible = new Set(visibleRef.current);
    markersRef.current.forEach(({ el }, key) => {
      el.hidden = !visible.has(key) && key !== selectedRef.current;
    });
    const map = mapRef.current;
    if (!map?.getLayer(DOTS_LAYER)) return;
    const ids = [...visible, ...(selectedRef.current ? [selectedRef.current] : [])];
    // The catalogue layers follow the same rule as the button markers: the
    // selection stays on the map even when the filter excludes it.
    const filter = ['in', ['get', 'id'], ['literal', ids]];
    map.setFilter(DOTS_LAYER, filter as never);
    map.setFilter(LABELS_LAYER, filter as never);
  };

  // One button marker per place would not scale; markers exist only for
  // featured places (made at init) and the selected place (made on demand).
  const addMarker = (place: MapPlace) => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl || markersRef.current.has(place.id)) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = MARKER_CLASS;
    el.dataset.exploreFocus = focusId.marker(place.id);
    el.setAttribute('aria-label', place.name);
    // Pressed state is right from the first frame, before the style loads.
    el.dataset.selected = String(place.id === selectedRef.current);
    el.setAttribute('aria-pressed', String(place.id === selectedRef.current));
    // Mapbox's Marker sets role="img" on any element without a role
    // (mapbox-gl-dev.js, Marker constructor), which turns the button into
    // an image and makes aria-pressed invalid. Setting it first keeps it.
    el.setAttribute('role', 'button');
    const diamond = document.createElement('span');
    diamond.className = DIAMOND_CLASS;
    diamond.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = LABEL_CLASS;
    label.setAttribute('aria-hidden', 'true');
    label.textContent = place.name;
    el.append(diamond, label);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelectRef.current(place.id);
    });
    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([place.lngLat[0], place.lngLat[1]])
      .addTo(map);
    markersRef.current.set(place.id, { marker, el });
    el.hidden = !visibleRef.current.includes(place.id) && place.id !== selectedRef.current;
  };

  // Reads refs only, so it is safe from the async map init and from effects.
  const applySelection = (animate: boolean) => {
    const id = selectedRef.current;
    const place = places.find((p) => p.id === id);
    // The selection always gets a button marker, so the label, the pressed
    // state and the focus-return target exist even for a dot-only place.
    if (place) addMarker(place);
    markersRef.current.forEach(({ el }, key) => {
      el.dataset.selected = String(key === id);
      el.setAttribute('aria-pressed', String(key === id));
    });
    const map = mapRef.current;
    if (!map || !place) return;
    // The docked inspector narrows the canvas in the same commit; sync the
    // map's size before framing or the centre lands off by half a pane.
    map.resize();
    const target = {
      center: [place.lngLat[0], place.lngLat[1]] as [number, number],
      zoom: Math.max(map.getZoom(), SELECT_MIN_ZOOM),
      padding: overlap(map, occluderRef.current),
      ...(mapViewRef.current === 'buildings'
        ? { pitch: BUILDING_PITCH, bearing: BUILDING_BEARING }
        : {}),
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) map.jumpTo(target);
    else map.flyTo({ ...target, speed: 1.4, essential: false });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!TOKEN) {
      setStatus('unavailable');
      return;
    }
    if (!container) return;
    setStatus('loading');
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const markers = markersRef.current;

    void mapboxglPromise?.then(({ default: mapboxgl }) => {
      if (cancelled) return;
      mapboxgl.accessToken = TOKEN;
      mapboxglRef.current = mapboxgl;
      const bounds = new mapboxgl.LngLatBounds();
      places.forEach((p) => bounds.extend([p.lngLat[0], p.lngLat[1]]));
      let map: MapboxMap;
      performance.mark('hm:map-create');
      try {
        map = new mapboxgl.Map({
          container,
          // Standard supplies the maintained 3D object, shadow and lighting
          // pass. Static Images cannot render Standard, so static cards use
          // the classic satellite style in MightsMapImage until the hosted
          // Harlem style lands (docs/adr/0003-explore-map-style-and-markers.md).
          style: 'mapbox://styles/mapbox/standard',
          config: {
            basemap: {
              theme: 'faded',
              lightPreset: 'day',
              show3dObjects: true,
              showPointOfInterestLabels: false,
              showTransitLabels: false,
            },
          },
          bounds,
          fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM },
          pitch: BUILDING_PITCH,
          bearing: BUILDING_BEARING,
          maxPitch: 72,
          attributionControl: true,
          cooperativeGestures: false,
        });
      } catch {
        // No WebGL: the constructor throws before any event can fire.
        setStatus('unavailable');
        return;
      }
      map.on('error', (e) => {
        if (/webgl/i.test(e.error?.message ?? '')) setStatus('unavailable');
      });
      map.once('idle', () => {
        performance.mark('hm:map-idle');
        performance.measure('hm:map-ready', 'hm:map-create', 'hm:map-idle');
        setStatus('ready');
      });
      // Top-left: the sheet and inspector own the bottom and right edges.
      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-left');
      mapRef.current = map;
      places.forEach((p) => {
        if (p.featured) addMarker(p);
      });
      applyVisibility();

      map.once('load', () => {
        // The whole catalogue as canvas layers — circles plus names that fade
        // in at street zoom. Standard's top slot keeps them above basemap
        // labels and 3D objects; the route lines attach after them.
        map.addSource(PLACES_SOURCE, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: places.map(placeFeature) },
        });
        map.addLayer({
          id: DOTS_LAYER,
          type: 'circle',
          source: PLACES_SOURCE,
          slot: 'top',
          minzoom: 13,
          paint: {
            'circle-color': semantic.primary.dark,
            // A fine-grained field at catalogue zoom, full dots at street zoom.
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 14.5, 2.5, 17, 5.5],
            'circle-stroke-color': semantic.surface.dark,
            'circle-stroke-width': 1,
            'circle-opacity': 0.85,
          },
        });
        map.addLayer({
          id: LABELS_LAYER,
          type: 'symbol',
          source: PLACES_SOURCE,
          slot: 'top',
          minzoom: 15.5,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1],
            'text-anchor': 'top',
            'text-optional': true,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          },
          paint: {
            'text-color': semantic.text.dark,
            'text-halo-color': semantic.surface.dark,
            'text-halo-width': 1.5,
          },
        });
        const onDotClick = (e: MapMouseEvent) => {
          const feature = e.features?.[0] as { properties?: Record<string, unknown> } | undefined;
          const id = feature?.properties?.id;
          if (typeof id === 'string') onSelectRef.current(id);
        };
        const pointerOn = () => {
          map.getCanvas().style.cursor = 'pointer';
        };
        const pointerOff = () => {
          map.getCanvas().style.cursor = '';
        };
        map.on('click', DOTS_LAYER, onDotClick);
        map.on('click', LABELS_LAYER, onDotClick);
        map.on('mouseenter', DOTS_LAYER, pointerOn);
        map.on('mouseleave', DOTS_LAYER, pointerOff);
        applyVisibility();
        applySelection(false);
        if (!selectedRef.current && mapViewRef.current === 'buildings' && map.getZoom() < 16)
          map.jumpTo({ zoom: 16, pitch: BUILDING_PITCH, bearing: BUILDING_BEARING });
        detachNavigationRef.current = attachNavigation(map, mapboxgl, () => occluderRef.current);
      });
      // A map created inside a hidden pane (view=list on a phone) has no size;
      // fit the bounds the first time it gets one.
      let fitted = container.clientWidth > 0;
      observer = new ResizeObserver(() => {
        map.resize();
        if (!fitted && container.clientWidth > 0) {
          fitted = true;
          map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, duration: 0 });
          applySelection(false);
          if (!selectedRef.current && mapViewRef.current === 'buildings' && map.getZoom() < 16)
            map.jumpTo({ zoom: 16, pitch: BUILDING_PITCH, bearing: BUILDING_BEARING });
        }
      });
      observer.observe(container);
    });

    return () => {
      cancelled = true;
      detachNavigationRef.current?.();
      detachNavigationRef.current = null;
      observer?.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxglRef.current = null;
    };
    // places is static catalogue data; the map is built once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyVisibility();
    // applyVisibility reads refs; the filter result and the selection are the triggers.
  }, [visibleKey, selectedId]);

  useEffect(() => {
    applySelection(true);
    // applySelection reads refs; the selection and the sheet's size are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, layoutKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Standard owns the 3D pass: 2D drops the objects, while Tilt keeps the
    // depth cue and Buildings pushes the camera far enough to read facades.
    map.setConfigProperty('basemap', 'show3dObjects', mapView !== 'map');
    const target = {
      pitch: mapView === 'map' ? 0 : mapView === 'tilt' ? 48 : BUILDING_PITCH,
      bearing: mapView === 'map' ? 0 : mapView === 'tilt' ? -12 : BUILDING_BEARING,
      zoom: mapView === 'buildings' ? Math.max(map.getZoom(), 16) : map.getZoom(),
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.jumpTo(target);
    else map.easeTo({ ...target, duration: 450 });
  }, [mapView]);

  return (
    <View className="relative h-full w-full">
      <View ref={containerRef as never} className="h-full w-full bg-surface-sunken" />
      <View
        role="group"
        aria-label="Map view"
        className={`absolute right-4 z-(--z-raised) flex-row gap-1 border border-border-strong bg-surface-raised p-1 ${guiding ? 'top-36' : 'top-4'}`}
      >
        {MAP_VIEWS.map(({ id, label }) => (
          <MightsButton
            key={id}
            size="sm"
            pressed={mapView === id}
            variant={mapView === id ? 'primary' : 'outline'}
            onPress={() => setMapView(id)}
          >
            {label}
          </MightsButton>
        ))}
      </View>
    </View>
  );
}
