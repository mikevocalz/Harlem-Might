'use client';

import { useEffect } from 'react';
import {
  Fit,
  RiveView,
  useRiveColor,
  useRiveFile,
  useRiveNumber,
  useRiveString,
  useViewModelInstance,
} from '@rive-app/react-native';
import { View } from '@acme/ui/tw';
import {
  EXPLORE_LOADER_ARTBOARD,
  EXPLORE_LOADER_BINDINGS,
  EXPLORE_LOADER_MACHINE,
  EXPLORE_LOADER_VIEW_MODEL,
  exploreLoaderColors,
} from './bindings';
import type { ExploreLoaderProps } from './ExploreLoader.types';

/** The shipped .riv, committed beside the component (built by rive --once). */
const BUNDLED_ASSET = require('./explore-loader.riv') as number;

export function ExploreLoader({
  source = BUNDLED_ASSET,
  size = 160,
  phase = 'loading',
  progress,
  scheme = 'dark',
  label = 'Loading',
  className,
}: ExploreLoaderProps) {
  const { riveFile } = useRiveFile(typeof source === 'number' ? (source as never) : { uri: source });
  const { instance } = useViewModelInstance(riveFile, {
    viewModelName: EXPLORE_LOADER_VIEW_MODEL,
    async: true,
  });

  const { setValue: setRingPrimary } = useRiveColor(EXPLORE_LOADER_BINDINGS.ringPrimary, instance);
  const { setValue: setRingAccent } = useRiveColor(EXPLORE_LOADER_BINDINGS.ringAccent, instance);
  const { setValue: setCore } = useRiveColor(EXPLORE_LOADER_BINDINGS.core, instance);
  const { setValue: setTrack } = useRiveColor(EXPLORE_LOADER_BINDINGS.track, instance);
  const { setValue: setPhase } = useRiveString(EXPLORE_LOADER_BINDINGS.phase, instance);
  const { setValue: setProgress } = useRiveNumber(EXPLORE_LOADER_BINDINGS.progress, instance);

  useEffect(() => {
    const colors = exploreLoaderColors(scheme);
    setRingPrimary(colors.ringPrimary);
    setRingAccent(colors.ringAccent);
    setCore(colors.core);
    setTrack(colors.track);
  }, [scheme, setRingPrimary, setRingAccent, setCore, setTrack]);

  useEffect(() => {
    setPhase(phase);
  }, [phase, setPhase]);

  useEffect(() => {
    if (progress !== undefined) setProgress(Math.min(1, Math.max(0, progress)));
  }, [progress, setProgress]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      className={className}
      style={{ width: size, height: size }}
    >
      {riveFile ? (
        <RiveView
          file={riveFile}
          artboardName={EXPLORE_LOADER_ARTBOARD}
          stateMachineName={EXPLORE_LOADER_MACHINE}
          dataBind={instance ?? undefined}
          autoPlay
          fit={Fit.Contain}
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </View>
  );
}
