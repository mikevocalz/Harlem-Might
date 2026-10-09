'use client';

import { Suspense } from 'react';
import { type ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { Main, View } from '@acme/ui/tw';
import { MightsButton, MightsHeading } from '@acme/ui/mights';
import { useNavigationHost } from '@acme/app/features/navigation/ui/useNavigationHost.ts';
import { createBrowserLocationSource } from '@acme/app/features/navigation/view/locationSource.ts';
import { MasterRegion } from './MasterRegion';
import type { MapPlace } from './ExploreMap';
import { MapRegion } from './MapRegion';
import { SheetRegion } from './SheetRegion';
import { MasterSkeleton } from './ExploreSkeletons';
import { ExploreRegionBoundary } from './ExploreRegionBoundary';
import { MapLoadOverlay } from './MapLoadOverlay';
import { parseExploreParams } from './explore-url';
import { useExploreActions } from './explore-actions';

// W3C Geolocation, foreground only. The site never asks for the camera.
const browserLocation = () =>
  createBrowserLocationSource(
    typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
    typeof navigator !== 'undefined' ? (navigator.permissions as never) : undefined,
  );

export interface ExploreWorkspaceProps {
  /**
   * Slim read — ids, names, featured flags, coordinates. The map region is
   * the only consumer: dots and the GL init never wait on the catalogue.
   */
  pointsPromise: Promise<readonly MapPlace[]>;
  /** Fuller read — categories, streets, summaries. List and sheet consume it. */
  cataloguePromise: Promise<readonly ExplorePlace[]>;
}

/**
 * The merged Explore workspace (ADR-024): one stage holding the master list,
 * the map and the place sheet. Each region suspends on the promise it needs
 * — the map on `pointsPromise`, the list and sheet on `cataloguePromise` —
 * and each boundary carries a fallback or overlay sized to its region.
 */
export function ExploreWorkspace({ pointsPromise, cataloguePromise }: ExploreWorkspaceProps) {
  // The one navigation session: the sheet's directions, the map line and the
  // HUD all read it.
  useNavigationHost(browserLocation);
  const { params, replace } = useExploreActions();
  const { view } = parseExploreParams(params, [], 'All');

  return (
    // grow-0: globals.css grows every main[role=main] to fill the shell, which
    // would push the phone toggle under the fixed dock.
    <Main className="grow-0 h-[calc(100dvh-var(--spacing)*16-var(--spacing-dock)-env(safe-area-inset-bottom))] flex-col overflow-hidden md:h-[calc(100dvh-var(--spacing)*16)]">
      <MightsHeading level={1} className="sr-only">
        Explore
      </MightsHeading>
      <View className="relative min-h-0 flex-1 md:flex-row">
        <ExploreRegionBoundary region="list">
          <Suspense fallback={<MasterSkeleton />}>
            <MasterRegion cataloguePromise={cataloguePromise} />
          </Suspense>
        </ExploreRegionBoundary>

        <View className={`relative min-w-0 flex-1 md:flex ${view === 'list' ? 'hidden' : 'flex'}`}>
          <ExploreRegionBoundary region="map">
            <Suspense fallback={null}>
              <MapRegion pointsPromise={pointsPromise} />
            </Suspense>
          </ExploreRegionBoundary>
          {/* The map's real wait is the GL style/tile load, longer than either
              promise — the overlay spans it via mapStatus. */}
          <MapLoadOverlay />
        </View>

        <ExploreRegionBoundary region="place details">
          <Suspense fallback={null}>
            <SheetRegion cataloguePromise={cataloguePromise} />
          </Suspense>
        </ExploreRegionBoundary>
      </View>

      {/* Phones: the toggle sits just above the dock, in thumb reach, and
          outside the stage so an open sheet never covers it. */}
      <View
        role="group"
        aria-label="View"
        className="flex-row justify-center gap-2 border-t border-rule-hairline bg-surface px-4 py-2 md:hidden"
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
