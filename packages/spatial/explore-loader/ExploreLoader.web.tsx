'use client';

import { useEffect } from 'react';
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceColor,
  useViewModelInstanceNumber,
  useViewModelInstanceString,
} from '@rive-app/react-webgl2';
import { View } from '@acme/ui/tw';
import {
  EXPLORE_LOADER_ARTBOARD,
  EXPLORE_LOADER_BINDINGS,
  EXPLORE_LOADER_MACHINE,
  EXPLORE_LOADER_VIEW_MODEL,
  exploreLoaderColors,
} from './bindings';
import type { ExploreLoaderProps } from './ExploreLoader.types';

/** #rrggbb → ARGB int for the web runtime's color setters. */
function colorToRiveInt(color: string) {
  const hex = color.replace('#', '').slice(0, 6).padEnd(6, '0');
  return Number.parseInt(`ff${hex}`, 16) >>> 0;
}

export function ExploreLoader({
  source,
  size = 160,
  phase = 'loading',
  progress,
  scheme = 'dark',
  label = 'Loading',
  className,
}: ExploreLoaderProps) {
  const { rive, RiveComponent } = useRive({
    src: typeof source === 'string' ? source : undefined,
    artboard: EXPLORE_LOADER_ARTBOARD,
    stateMachines: EXPLORE_LOADER_MACHINE,
    autoplay: true,
    autoBind: false,
  });
  const viewModel = useViewModel(rive, { name: EXPLORE_LOADER_VIEW_MODEL });
  const instance = useViewModelInstance(viewModel, { rive });

  const { setValue: setRingPrimary } = useViewModelInstanceColor(EXPLORE_LOADER_BINDINGS.ringPrimary, instance);
  const { setValue: setRingAccent } = useViewModelInstanceColor(EXPLORE_LOADER_BINDINGS.ringAccent, instance);
  const { setValue: setCore } = useViewModelInstanceColor(EXPLORE_LOADER_BINDINGS.core, instance);
  const { setValue: setTrack } = useViewModelInstanceColor(EXPLORE_LOADER_BINDINGS.track, instance);
  const { setValue: setPhase } = useViewModelInstanceString(EXPLORE_LOADER_BINDINGS.phase, instance);
  const { setValue: setProgress } = useViewModelInstanceNumber(EXPLORE_LOADER_BINDINGS.progress, instance);

  useEffect(() => {
    const colors = exploreLoaderColors(scheme);
    setRingPrimary(colorToRiveInt(colors.ringPrimary));
    setRingAccent(colorToRiveInt(colors.ringAccent));
    setCore(colorToRiveInt(colors.core));
    setTrack(colorToRiveInt(colors.track));
  }, [scheme, setRingPrimary, setRingAccent, setCore, setTrack]);

  useEffect(() => {
    setPhase(phase);
  }, [phase, setPhase]);

  useEffect(() => {
    if (progress !== undefined) setProgress(Math.min(1, Math.max(0, progress)));
  }, [progress, setProgress]);

  const determinate = progress !== undefined;
  return (
    <View
      role="progressbar"
      aria-label={label}
      {...(determinate ? { 'aria-valuenow': Math.round(progress * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}
      className={className}
      style={{ width: size, height: size }}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
