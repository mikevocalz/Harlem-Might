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
  type ViewModelInstance,
} from '@rive-app/react-native';
import { View } from '@acme/ui/tw';
import {
  GRID_CORE_SPINNER_ARTBOARD,
  GRID_CORE_SPINNER_MACHINE,
  GRID_FX_BINDINGS,
  GRID_FX_MACHINE,
  GRID_FX_VIEW_MODEL,
  gridFxArtboardFor,
} from './bindings';
import { useGridFxStore } from './store';
import type { GridFxEvent } from './types';

export type GridFxStageProps = {
  source: string;
  className?: string;
  height?: number;
};

function BoundGridFx({
  file,
  instance,
  event,
  className,
  height,
}: GridFxStageProps & {
  file: NonNullable<ReturnType<typeof useRiveFile>['riveFile']>;
  instance: ViewModelInstance;
  event: GridFxEvent;
}) {
  const { setValue: setPlayerColor } = useRiveColor(
    GRID_FX_BINDINGS.playerColor,
    instance,
  );
  const { setValue: setOpponentColor } = useRiveColor(
    GRID_FX_BINDINGS.opponentColor,
    instance,
  );
  const { setValue: setIntensity } = useRiveNumber(
    GRID_FX_BINDINGS.intensity,
    instance,
  );
  const { setValue: setSeed } = useRiveNumber(GRID_FX_BINDINGS.seed, instance);
  const { setValue: setImpactAngle } = useRiveNumber(
    GRID_FX_BINDINGS.impactAngle,
    instance,
  );
  const { setValue: setVelocity } = useRiveNumber(
    GRID_FX_BINDINGS.velocity,
    instance,
  );
  const { setValue: setWorldX } = useRiveNumber(
    GRID_FX_BINDINGS.worldX,
    instance,
  );
  const { setValue: setWorldY } = useRiveNumber(
    GRID_FX_BINDINGS.worldY,
    instance,
  );
  const { setValue: setWorldZ } = useRiveNumber(
    GRID_FX_BINDINGS.worldZ,
    instance,
  );
  const { setValue: setSerial } = useRiveNumber(
    GRID_FX_BINDINGS.serial,
    instance,
  );
  const { setValue: setEffectType } = useRiveString(
    GRID_FX_BINDINGS.effectType,
    instance,
  );
  const { setValue: setCollisionCause } = useRiveString(
    GRID_FX_BINDINGS.collisionCause,
    instance,
  );
  const { setValue: setQualityTier } = useRiveString(
    GRID_FX_BINDINGS.qualityTier,
    instance,
  );
  const { setValue: setWinner } = useRiveString(
    GRID_FX_BINDINGS.winner,
    instance,
  );
  const { setValue: setLocalPlayer } = useRiveString(
    GRID_FX_BINDINGS.localPlayer,
    instance,
  );

  useEffect(() => {
    setPlayerColor(event.playerColor);
    setOpponentColor(event.opponentColor);
    setIntensity(event.intensity);
    setSeed(event.seed);
    setImpactAngle(event.impactAngle);
    setVelocity(event.velocity);
    setWorldX(event.world.x);
    setWorldY(event.world.y);
    setWorldZ(event.world.z);
    setSerial(event.serial);
    setEffectType(event.type);
    setCollisionCause(event.collisionCause);
    setQualityTier(event.qualityTier);
    setWinner(event.winner);
    setLocalPlayer(event.localPlayer);
  }, [
    event,
    setCollisionCause,
    setEffectType,
    setImpactAngle,
    setIntensity,
    setLocalPlayer,
    setOpponentColor,
    setPlayerColor,
    setQualityTier,
    setSeed,
    setSerial,
    setVelocity,
    setWinner,
    setWorldX,
    setWorldY,
    setWorldZ,
  ]);

  return (
    <View className={className} style={{ height }}>
      <RiveView
        key={event.serial}
        file={file}
        artboardName={gridFxArtboardFor(event.type)}
        stateMachineName={GRID_FX_MACHINE}
        dataBind={instance}
        autoPlay
        fit={Fit.Contain}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

export function GridFxStage({
  source,
  className,
  height = 280,
}: GridFxStageProps) {
  const event = useGridFxStore((state) => state.current);
  const { riveFile } = useRiveFile({ uri: source });
  const { instance } = useViewModelInstance(riveFile, {
    viewModelName: GRID_FX_VIEW_MODEL,
    async: true,
  });

  if (!event || !riveFile || !instance) return null;

  return (
    <BoundGridFx
      source={source}
      file={riveFile}
      instance={instance}
      event={event}
      className={className}
      height={height}
    />
  );
}

export type GridCoreSpinnerProps = {
  source: string;
  size?: number;
  className?: string;
};

export function GridCoreSpinner({
  source,
  size = 96,
  className,
}: GridCoreSpinnerProps) {
  const { riveFile } = useRiveFile({ uri: source });

  return (
    <View className={className} style={{ width: size, height: size }}>
      {riveFile ? (
        <RiveView
          file={riveFile}
          artboardName={GRID_CORE_SPINNER_ARTBOARD}
          stateMachineName={GRID_CORE_SPINNER_MACHINE}
          autoPlay
          fit={Fit.Contain}
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </View>
  );
}
