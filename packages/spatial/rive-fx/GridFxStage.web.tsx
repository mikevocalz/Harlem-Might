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
  GRID_CORE_SPINNER_ARTBOARD,
  GRID_CORE_SPINNER_MACHINE,
  GRID_FX_BINDINGS,
  GRID_FX_MACHINE,
  GRID_FX_VIEW_MODEL,
  gridFxArtboardFor,
} from './bindings';
import { useGridFxStore } from './store';

export type GridFxStageProps = {
  source: string;
  className?: string;
  height?: number;
};

function colorToRiveInt(color: string) {
  const hex = color.replace('#', '').slice(0, 6).padEnd(6, '0');
  return Number.parseInt(`ff${hex}`, 16) >>> 0;
}

export function GridFxStage({
  source,
  className,
  height = 280,
}: GridFxStageProps) {
  const event = useGridFxStore((state) => state.current);
  const artboard = event ? gridFxArtboardFor(event.type) : 'GridImpact';
  const { rive, RiveComponent } = useRive({
    src: source,
    artboard,
    stateMachines: GRID_FX_MACHINE,
    autoplay: Boolean(event),
    autoBind: false,
  });
  const viewModel = useViewModel(rive, { name: GRID_FX_VIEW_MODEL });
  const instance = useViewModelInstance(viewModel, { rive });

  const { setValue: setPlayerColor } = useViewModelInstanceColor(
    GRID_FX_BINDINGS.playerColor,
    instance,
  );
  const { setValue: setOpponentColor } = useViewModelInstanceColor(
    GRID_FX_BINDINGS.opponentColor,
    instance,
  );
  const { setValue: setIntensity } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.intensity,
    instance,
  );
  const { setValue: setSeed } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.seed,
    instance,
  );
  const { setValue: setImpactAngle } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.impactAngle,
    instance,
  );
  const { setValue: setVelocity } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.velocity,
    instance,
  );
  const { setValue: setWorldX } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.worldX,
    instance,
  );
  const { setValue: setWorldY } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.worldY,
    instance,
  );
  const { setValue: setWorldZ } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.worldZ,
    instance,
  );
  const { setValue: setSerial } = useViewModelInstanceNumber(
    GRID_FX_BINDINGS.serial,
    instance,
  );
  const { setValue: setEffectType } = useViewModelInstanceString(
    GRID_FX_BINDINGS.effectType,
    instance,
  );
  const { setValue: setCollisionCause } = useViewModelInstanceString(
    GRID_FX_BINDINGS.collisionCause,
    instance,
  );
  const { setValue: setQualityTier } = useViewModelInstanceString(
    GRID_FX_BINDINGS.qualityTier,
    instance,
  );
  const { setValue: setWinner } = useViewModelInstanceString(
    GRID_FX_BINDINGS.winner,
    instance,
  );
  const { setValue: setLocalPlayer } = useViewModelInstanceString(
    GRID_FX_BINDINGS.localPlayer,
    instance,
  );

  useEffect(() => {
    if (!event) return;

    setPlayerColor(colorToRiveInt(event.playerColor));
    setOpponentColor(colorToRiveInt(event.opponentColor));
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

    rive?.reset();
    rive?.play();
  }, [
    event,
    rive,
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

  if (!event) return null;

  return (
    <View className={className} style={{ height }}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </View>
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
  const { RiveComponent } = useRive({
    src: source,
    artboard: GRID_CORE_SPINNER_ARTBOARD,
    stateMachines: GRID_CORE_SPINNER_MACHINE,
    autoplay: true,
    autoBind: true,
  });

  return (
    <View className={className} style={{ width: size, height: size }}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
