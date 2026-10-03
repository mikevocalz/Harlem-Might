'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import { View } from '@acme/ui/tw';
import { MightsText } from '@acme/ui/mights';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface MapPlace {
  id: string;
  name: string;
  lngLat: readonly [number, number];
}

interface ExploreMapProps {
  places: readonly MapPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Pixels of map covered on the right by the detail sheet (desktop). */
  rightInset: number;
  /** Pixels covered at the bottom by the dock/sheet (mobile). */
  bottomInset: number;
}

const MARKER = 'mights-marker';

// Mapbox GL JS v3, driven imperatively through refs: one map per mount,
// DOM-button markers, flyTo on selection (jumpTo under reduced motion).
export function ExploreMap({ places, selectedId, onSelect, rightInset, bottomInset }: ExploreMapProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const padRef = useRef({ rightInset, bottomInset });
  padRef.current = { rightInset, bottomInset };
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Reads refs only, so it is safe from the async map init and from effects.
  const applySelection = (animate: boolean) => {
    const id = selectedRef.current;
    markersRef.current.forEach(({ el }, key) => {
      el.dataset.selected = String(key === id);
    });
    const map = mapRef.current;
    const place = places.find((p) => p.id === id);
    if (!map || !place) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = {
      center: [place.lngLat[0], place.lngLat[1]] as [number, number],
      zoom: Math.max(map.getZoom(), 16.5),
      // Desktop: the sheet covers the right edge. Mobile: it covers the lower 60%.
      padding:
        map.getContainer().clientWidth >= 1024
          ? { top: 0, left: 0, right: padRef.current.rightInset, bottom: padRef.current.bottomInset }
          : { top: 56, left: 0, right: 0, bottom: Math.round(map.getContainer().clientHeight * 0.6) },
    };
    if (!animate || reduce) map.jumpTo(target);
    else map.flyTo({ ...target, speed: 1.4, essential: false });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !TOKEN) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const markers = markersRef.current;

    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled) return;
      mapboxgl.accessToken = TOKEN;
      const bounds = new mapboxgl.LngLatBounds();
      places.forEach((p) => bounds.extend([p.lngLat[0], p.lngLat[1]]));
      const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        bounds,
        fitBoundsOptions: { padding: 96, maxZoom: 15.5 },
        pitch: 30,
        attributionControl: true,
        cooperativeGestures: false,
      });
      // Top-left: the detail sheet owns the right edge, the toggle the top-right.
      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-left');
      mapRef.current = map;

      places.forEach((p) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = MARKER;
        el.setAttribute('aria-label', `${p.name}, show on map`);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current(p.id);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([p.lngLat[0], p.lngLat[1]])
          .addTo(map);
        markers.set(p.id, { marker, el });
      });

      map.once('load', () => applySelection(false));
      observer = new ResizeObserver(() => map.resize());
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
    applySelection(true);
    // applySelection reads refs; selectedId is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!TOKEN) {
    return (
      <View className="h-full w-full items-start justify-end bg-surface-sunken p-6">
        <MightsText size="small">Map unavailable: no Mapbox token configured.</MightsText>
      </View>
    );
  }

  return <View ref={containerRef as never} className="h-full w-full bg-surface-sunken" />;
}
