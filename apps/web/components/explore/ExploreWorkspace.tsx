'use client';

import { type ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { Main, View } from '@acme/ui/tw';
import { MightsButton, MightsHeading } from '@acme/ui/mights';
import { useNavigationHost } from '@acme/app/features/navigation/ui/useNavigationHost.ts';
import { createBrowserLocationSource } from '@acme/app/features/navigation/view/locationSource.ts';
import { MasterRegion } from './MasterRegion';
import type { MapPlace } from './ExploreMap';
import { MapRegion } from './MapRegion';
import { SheetRegion } from './SheetRegion';
import { ExploreRegionBoundary } from './ExploreRegionBoundary';
import { MapLoadOverlay } from './MapLoadOverlay';
import { parseExploreParams } from './explore-url';
import { PHONE, useExploreActions } from './explore-actions';
import { useMediaQuery } from './use-media-query';

// W3C Geolocation, foreground only. The site never asks for the camera.
const browserLocation = () =>
  createBrowserLocationSource(
    typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
    typeof navigator !== 'undefined' ? (navigator.permissions as never) : undefined,
  );

export interface ExploreWorkspaceProps {
  /** Slim read — ids, names, coordinates. The map's only input. */
  points: readonly MapPlace[];
  /** Fuller read — categories, streets, summaries. List and sheet consume it. */
  catalogue: readonly ExplorePlace[];
}

/**
 * The merged Explore workspace (ADR-024): one stage holding the master list,
 * the map and the place sheet. The page's single Suspense boundary resolves
 * both reads before this renders, and `MapLoadOverlay` then covers the whole
 * stage until the GL map is ready — the regions reveal together, never the
 * map first and the list last.
 */
export function ExploreWorkspace({ points, catalogue }: ExploreWorkspaceProps) {
  // The one navigation session: the sheet's directions, the map line and the
  // HUD all read it.
  useNavigationHost(browserLocation);
  const { params, replace } = useExploreActions();
  const { view } = parseExploreParams(params, [], 'All');
  const phone = useMediaQuery(PHONE);

  return (
    // grow-0: globals.css grows every main[role=main] to fill the shell, which
    // would push the phone toggle under the fixed dock.
    <Main className="grow-0 h-[calc(100dvh-var(--spacing)*16-var(--spacing-dock)-env(safe-area-inset-bottom))] flex-col overflow-hidden me:h-[calc(100dvh-var(--spacing)*16)]">
      <MightsHeading level={1} className="sr-only">
        Explore
      </MightsHeading>
      <View className="relative min-h-0 flex-1 me:flex-row">
        <ExploreRegionBoundary region="list">
          <MasterRegion catalogue={catalogue} />
        </ExploreRegionBoundary>

        <View className={`relative min-w-0 flex-1 me:flex ${view === 'list' ? 'hidden' : 'flex'}`}>
          <ExploreRegionBoundary region="map">
            <MapRegion points={points} />
          </ExploreRegionBoundary>
        </View>

        <ExploreRegionBoundary region="place details">
          <SheetRegion catalogue={catalogue} />
        </ExploreRegionBoundary>

        {/* The GL style/tile load is the longest wait; the overlay spans the
            whole stage through it so the list doesn't show before the map.
            Phones in list view never wait on a map they can't see. */}
        {phone && view === 'list' ? null : <MapLoadOverlay />}
      </View>

      {/* Phones: the toggle sits just above the dock, in thumb reach, and
          outside the stage so an open sheet never covers it. */}
      <View
        role="group"
        aria-label="View"
        className="flex-row justify-center gap-2 border-t border-rule-hairline bg-surface px-4 py-2 me:hidden"
      >
        {(['map', 'list'] as const).map((v) => (
          <MightsButton
            key={v}
            size="sm"
            pressed={view === v}
            variant={view === v ? 'primary' : 'outline'}
            onPress={() => replace({ view: v === 'map' ? null : 'list' })}
          >
            {v === 'map' ? 'Map' : 'List'}
          </MightsButton>
        ))}
      </View>
    </Main>
  );
}
