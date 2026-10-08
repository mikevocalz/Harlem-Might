'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MapboxMap, Marker, PaddingOptions } from 'mapbox-gl';
import { View } from '@acme/ui/tw';
import { focusId } from './explore-url';
import { useMapStatus } from './map-status';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface MapPlace {
  id: string;
  name: string;
  lngLat: readonly [number, number];
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

// Mapbox GL JS v3, driven imperatively through refs: one map per mount,
// DOM-button markers, flyTo on selection (jumpTo under reduced motion).
export function ExploreMap({ places, visibleIds, selectedId, onSelect, occluderRef, layoutKey }: ExploreMapProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const visibleRef = useRef(visibleIds);
  visibleRef.current = visibleIds;
  // A primitive dependency: the parent builds a new array every render.
  const visibleKey = visibleIds.join('\n');
  const setStatus = useMapStatus((s) => s.setStatus);

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
  };

  // Reads refs only, so it is safe from the async map init and from effects.
  const applySelection = (animate: boolean) => {
    const id = selectedRef.current;
    markersRef.current.forEach(({ el }, key) => {
      el.dataset.selected = String(key === id);
      el.setAttribute('aria-pressed', String(key === id));
    });
    const map = mapRef.current;
    const place = places.find((p) => p.id === id);
    if (!map || !place) return;
    // The docked inspector narrows the canvas in the same commit; sync the
    // map's size before framing or the centre lands off by half a pane.
    map.resize();
    const target = {
      center: [place.lngLat[0], place.lngLat[1]] as [number, number],
      zoom: Math.max(map.getZoom(), SELECT_MIN_ZOOM),
      padding: overlap(map, occluderRef.current),
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

    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled) return;
      mapboxgl.accessToken = TOKEN;
      const bounds = new mapboxgl.LngLatBounds();
      places.forEach((p) => bounds.extend([p.lngLat[0], p.lngLat[1]]));
      let map: MapboxMap;
      performance.mark('hm:map-create');
      try {
        map = new mapboxgl.Map({
          container,
          // Stays on dark-v11 until the token-built style is on the account:
          // Static Images can't take an inline style, and a warm Explore next
          // to grey home/place rasters is worse than one consistent grey.
          style: 'mapbox://styles/mapbox/dark-v11',
          bounds,
          fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM },
          pitch: 30,
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
        const el = document.createElement('button');
        el.type = 'button';
        el.className = MARKER_CLASS;
        el.dataset.exploreFocus = focusId.marker(p.id);
        el.setAttribute('aria-label', p.name);
        // Pressed state is right from the first frame, before the style loads.
        el.dataset.selected = String(p.id === selectedRef.current);
        el.setAttribute('aria-pressed', String(p.id === selectedRef.current));
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
        label.textContent = p.name;
        el.append(diamond, label);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current(p.id);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([p.lngLat[0], p.lngLat[1]])
          .addTo(map);
        markers.set(p.id, { marker, el });
      });
      applyVisibility();

      map.once('load', () => applySelection(false));
      // A map created inside a hidden pane (view=list on a phone) has no size;
      // fit the bounds the first time it gets one.
      let fitted = container.clientWidth > 0;
      observer = new ResizeObserver(() => {
        map.resize();
        if (!fitted && container.clientWidth > 0) {
          fitted = true;
          map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, duration: 0 });
          applySelection(false);
        }
      });
      observer.observe(container);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
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

  return <View ref={containerRef as never} className="h-full w-full bg-surface-sunken" />;
}
