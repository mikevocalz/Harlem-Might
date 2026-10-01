'use client';

import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ViroAmbientLight,
  ViroBox,
  ViroController,
  ViroDirectionalLight,
  ViroGameLoop,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroScene,
  ViroText,
  triggerViroHaptic,
  useViroVRViewTag,
} from './viro';
import {
  getActiveTrailSegments,
  GRID_ARENA_HALF,
  GRID_CELL,
  type GridPoint,
  type GridRaceSimulation,
  type GridRiderId,
  type GridRiderState,
  type GridTrailSegment,
  type GridTurn,
} from './gridRaceEngine';
import { gridRace, useGridRaceStore } from './gridRaceStore';

ViroMaterials.createMaterials({
  raceCyan: { diffuseColor: '#00f3ff', lightingModel: 'Constant' },
  raceOrange: { diffuseColor: '#ff7a00', lightingModel: 'Constant' },
  raceGold: { diffuseColor: '#ffd24a', lightingModel: 'Constant' },
  raceWhite: { diffuseColor: '#fff6cf', lightingModel: 'Constant' },
  raceRed: { diffuseColor: '#ff355e', lightingModel: 'Constant' },
  raceDark: { diffuseColor: '#020407', lightingModel: 'Constant' },
});

const CAMERA_PLAYER_Z = -4.2;
const GRID_LINES = Array.from(
  { length: Math.floor((GRID_ARENA_HALF * 2) / GRID_CELL) + 1 },
  (_, index) => -GRID_ARENA_HALF + index * GRID_CELL,
);

const RIDER_MATERIAL: Record<GridRiderId, string> = {
  player: 'raceCyan',
  'rival-a': 'raceOrange',
  'rival-b': 'raceGold',
  'rival-c': 'raceWhite',
};

const RIVAL_IDS: GridRiderId[] = ['rival-a', 'rival-b', 'rival-c'];

type LocalPoint = [number, number, number];

function directionVector(direction: GridRiderState['direction']): GridPoint {
  return (
    [
      { x: 0, z: -1 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: -1, z: 0 },
    ][direction] ?? { x: 0, z: -1 }
  );
}

function worldToLocal(point: GridPoint, player: GridRiderState): LocalPoint {
  const forward = directionVector(player.direction);
  const right = { x: -forward.z, z: forward.x };
  const dx = point.x - player.position.x;
  const dz = point.z - player.position.z;
  const lateral = dx * right.x + dz * right.z;
  const forwardDistance = dx * forward.x + dz * forward.z;

  return [lateral, -1.5, CAMERA_PLAYER_Z - forwardDistance];
}

function Gateway({ onStart }: { onStart: () => void }) {
  return (
    <>
      <ViroText
        text="GRID ACCESS"
        position={[0, 2.35, -6.2]}
        width={5}
        height={0.8}
        style={{ fontSize: 24, color: '#fff6cf', textAlign: 'center' }}
      />
      <ViroText
        text="SELECT THE GATE TO ENTER"
        position={[0, 1.75, -6.2]}
        width={5}
        height={0.5}
        style={{ fontSize: 15, color: '#00f3ff', textAlign: 'center' }}
      />
      <ViroBox position={[-2.7, 0.45, -8]} scale={[0.09, 2.1, 0.09]} materials={['raceOrange']} />
      <ViroBox position={[2.7, 0.45, -8]} scale={[0.09, 2.1, 0.09]} materials={['raceOrange']} />
      <ViroBox position={[0, 2.55, -8]} scale={[2.79, 0.09, 0.09]} materials={['raceOrange']} />
      <ViroBox
        position={[0, 0.35, -8.05]}
        scale={[2.55, 1.95, 0.035]}
        materials={['raceDark']}
        onClick={onStart}
      />
      {[-1.7, -0.85, 0, 0.85, 1.7].map((x) => (
        <ViroPolyline
          key={x}
          points={[[x, -1.4, -7.95], [x, 2.35, -7.95]]}
          thickness={0.012}
          materials={['raceCyan']}
        />
      ))}
    </>
  );
}

function ArenaGrid({ player }: { player: GridRiderState }) {
  const floorLines = useMemo(() => {
    const lines: { key: string; a: LocalPoint; b: LocalPoint }[] = [];
    for (const value of GRID_LINES) {
      lines.push({
        key: `x-${value}`,
        a: worldToLocal({ x: value, z: -GRID_ARENA_HALF }, player),
        b: worldToLocal({ x: value, z: GRID_ARENA_HALF }, player),
      });
      lines.push({
        key: `z-${value}`,
        a: worldToLocal({ x: -GRID_ARENA_HALF, z: value }, player),
        b: worldToLocal({ x: GRID_ARENA_HALF, z: value }, player),
      });
    }
    return lines;
  }, [player]);

  const perimeter = [
    { x: -GRID_ARENA_HALF, z: -GRID_ARENA_HALF },
    { x: GRID_ARENA_HALF, z: -GRID_ARENA_HALF },
    { x: GRID_ARENA_HALF, z: GRID_ARENA_HALF },
    { x: -GRID_ARENA_HALF, z: GRID_ARENA_HALF },
    { x: -GRID_ARENA_HALF, z: -GRID_ARENA_HALF },
  ].map((point) => worldToLocal(point, player));

  return (
    <>
      {floorLines.map((line) => (
        <ViroPolyline
          key={line.key}
          points={[line.a, line.b]}
          thickness={0.012}
          materials={['raceCyan']}
        />
      ))}
      <ViroPolyline
        points={perimeter}
        thickness={0.055}
        materials={['raceOrange']}
      />
      <ViroPolyline
        points={perimeter.map(([x, , z]) => [x, 0.25, z] as LocalPoint)}
        thickness={0.03}
        materials={['raceOrange']}
      />
      {GRID_LINES.filter((_, index) => index % 3 === 0).flatMap((value) => {
        const posts = [
          { x: value, z: -GRID_ARENA_HALF },
          { x: value, z: GRID_ARENA_HALF },
          { x: -GRID_ARENA_HALF, z: value },
          { x: GRID_ARENA_HALF, z: value },
        ];
        return posts.map((point, index) => {
          const [x, , z] = worldToLocal(point, player);
          return (
            <ViroPolyline
              key={`post-${value}-${index}`}
              points={[[x, -1.5, z], [x, 1.2, z]]}
              thickness={0.025}
              materials={['raceOrange']}
            />
          );
        });
      })}
    </>
  );
}

function TrailWall({
  segment,
  player,
}: {
  segment: GridTrailSegment;
  player: GridRiderState;
}) {
  const a = worldToLocal(segment.from, player);
  const b = worldToLocal(segment.to, player);
  const dx = Math.abs(a[0] - b[0]);
  const dz = Math.abs(a[2] - b[2]);
  const length = Math.max(dx, dz);
  if (length < 0.06) return null;

  const position: LocalPoint = [
    (a[0] + b[0]) / 2,
    -0.88,
    (a[2] + b[2]) / 2,
  ];

  return (
    <ViroBox
      position={position}
      scale={dx >= dz ? [length, 0.62, 0.045] : [0.045, 0.62, length]}
      materials={[RIDER_MATERIAL[segment.owner]]}
    />
  );
}

function CycleModel({
  rider,
  player,
}: {
  rider: GridRiderState;
  player: GridRiderState;
}) {
  if (!rider.alive) return null;

  const position = worldToLocal(rider.position, player);
  const relativeDirection = ((rider.direction - player.direction) * 90 + 360) % 360;
  const material = RIDER_MATERIAL[rider.id];

  return (
    <ViroNode position={[position[0], -0.92, position[2]]} rotation={[0, relativeDirection, 0]}>
      <ViroBox position={[0, 0, 0]} scale={[0.42, 0.14, 0.82]} materials={[material]} />
      <ViroBox position={[0, 0.18, 0.02]} scale={[0.12, 0.22, 0.34]} materials={['raceDark']} />
      <ViroBox position={[0, 0.25, -0.24]} scale={[0.08, 0.12, 0.18]} materials={[material]} />
      <ViroBox position={[-0.31, -0.07, 0]} scale={[0.055, 0.28, 0.36]} materials={[material]} />
      <ViroBox position={[0.31, -0.07, 0]} scale={[0.055, 0.28, 0.36]} materials={[material]} />
      <ViroPolyline
        points={[[-0.42, 0.1, 0.35], [0, 0.28, -0.62], [0.42, 0.1, 0.35]]}
        thickness={0.045}
        materials={[material]}
      />
    </ViroNode>
  );
}

function CrashMarker({
  rider,
  player,
}: {
  rider: GridRiderState;
  player: GridRiderState;
}) {
  if (rider.alive) return null;
  const [x, , z] = worldToLocal(rider.position, player);
  return (
    <ViroNode position={[x, -0.75, z]}>
      <ViroPolyline points={[[-0.5, 0, 0], [0.5, 0.8, 0]]} thickness={0.055} materials={['raceRed']} />
      <ViroPolyline points={[[0.5, 0, 0], [-0.5, 0.8, 0]]} thickness={0.055} materials={['raceRed']} />
      <ViroPolyline points={[[0, -0.05, -0.5], [0, 0.65, 0.5]]} thickness={0.035} materials={['raceWhite']} />
    </ViroNode>
  );
}

function RaceHud({ simulation }: { simulation: GridRaceSimulation }) {
  const player = simulation.riders.player;
  const liveRivals = RIVAL_IDS.filter((id) => simulation.riders[id].alive).length;
  const boost = Math.round(player.energy * 100);
  const speed = Math.round(player.speed * 10) / 10;

  let headline = `ROUND ${simulation.round}`;
  if (simulation.phase === 'countdown') {
    headline = simulation.countdown > 0.35 ? String(Math.ceil(simulation.countdown)) : 'RUN';
  } else if (simulation.phase === 'round-over') {
    headline = simulation.winner === 'player' ? 'GRID CLEARED' : 'DEREZZED';
  } else if (simulation.phase === 'match-over') {
    headline = simulation.matchWinner === 'player' ? 'MATCH WON' : 'GRID WINS';
  }

  return (
    <>
      <ViroText
        text={headline}
        position={[0, 2.25, -4.8]}
        width={6}
        height={0.75}
        style={{ fontSize: 24, color: '#fff6cf', textAlign: 'center' }}
      />
      <ViroText
        text={`YOU ${simulation.scores.player}  /  GRID ${simulation.scores.grid}   •   RIVALS ${liveRivals}   •   BOOST ${boost}%   •   ${speed} U/S`}
        position={[0, 1.73, -4.8]}
        width={7.5}
        height={0.45}
        style={{ fontSize: 13, color: '#00f3ff', textAlign: 'center' }}
      />
      <ViroBox position={[0, 1.42, -4.82]} scale={[2.2, 0.035, 0.025]} materials={['raceDark']} />
      <ViroBox
        position={[-2.2 + player.energy * 2.2, 1.42, -4.77]}
        scale={[Math.max(0.02, player.energy * 2.2), 0.025, 0.018]}
        materials={[player.energy > 0.2 ? 'raceCyan' : 'raceRed']}
      />
      <ViroText
        text="SWIPE / STICK L-R = 90° TURN   •   TRIGGER / A / STICK UP = BOOST"
        position={[0, -1.82, -4.1]}
        width={7}
        height={0.35}
        style={{ fontSize: 10, color: '#fff6cf', textAlign: 'center' }}
      />
    </>
  );
}

function HeadsetInput() {
  const viewTag = useViroVRViewTag();
  const Controller = ViroController as unknown as ComponentType<{
    reticleVisibility?: boolean;
    controllerVisibility?: boolean;
    onSwipe?: (state: number, source: number) => void;
    onClickState?: (state: number, position: number[], source: number) => void;
  }>;

  const tick = (amplitude = 0.34, durationSec = 0.025) =>
    triggerViroHaptic(viewTag, { hand: 'active', amplitude, durationSec });

  return (
    <Controller
      reticleVisibility={false}
      controllerVisibility={false}
      onSwipe={(state) => {
        if (state === 3) {
          gridRace.queueTurn(-1);
          tick();
        }
        if (state === 4) {
          gridRace.queueTurn(1);
          tick();
        }
        if (state === 1) {
          gridRace.pulseBoost();
          tick(0.5, 0.04);
        }
      }}
      onClickState={(state) => {
        if (state === 1) {
          gridRace.setBoost(true);
          tick(0.42, 0.035);
        }
        if (state === 2 || state === 3) {
          gridRace.setBoost(false);
        }
      }}
    />
  );
}

function RaceWorld({
  simulation,
  onRestart,
}: {
  simulation: GridRaceSimulation;
  onRestart: () => void;
}) {
  const player = simulation.riders.player;
  const trails = [...simulation.trails, ...getActiveTrailSegments(simulation)];

  return (
    <>
      <ArenaGrid player={player} />

      {trails.map((segment) => (
        <TrailWall key={`${segment.owner}-${segment.id}`} segment={segment} player={player} />
      ))}

      {(['player', 'rival-a', 'rival-b', 'rival-c'] as GridRiderId[]).map((id) => (
        <CycleModel key={id} rider={simulation.riders[id]} player={player} />
      ))}

      {simulation.phase === 'round-over' || simulation.phase === 'match-over'
        ? (['player', 'rival-a', 'rival-b', 'rival-c'] as GridRiderId[]).map((id) => (
            <CrashMarker key={`crash-${id}`} rider={simulation.riders[id]} player={player} />
          ))
        : null}

      <RaceHud simulation={simulation} />
      <HeadsetInput />

      <ViroBox
        position={[-3.1, -0.45, -3.3]}
        scale={[0.52, 0.22, 0.07]}
        materials={['raceDark']}
        onClick={() => gridRace.queueTurn(-1)}
      />
      <ViroText
        text="TURN L"
        position={[-3.1, -0.41, -3.2]}
        width={1.2}
        height={0.3}
        style={{ fontSize: 14, color: '#00f3ff', textAlign: 'center' }}
      />
      <ViroBox
        position={[3.1, -0.45, -3.3]}
        scale={[0.52, 0.22, 0.07]}
        materials={['raceDark']}
        onClick={() => gridRace.queueTurn(1)}
      />
      <ViroText
        text="TURN R"
        position={[3.1, -0.41, -3.2]}
        width={1.2}
        height={0.3}
        style={{ fontSize: 14, color: '#ff7a00', textAlign: 'center' }}
      />

      {simulation.phase === 'match-over' ? (
        <>
          <ViroBox
            position={[0, 0.42, -5.1]}
            scale={[1.35, 0.34, 0.06]}
            materials={['raceDark']}
            onClick={onRestart}
          />
          <ViroText
            text="RESTART MATCH"
            position={[0, 0.47, -5]}
            width={2.8}
            height={0.42}
            style={{ fontSize: 16, color: '#fff6cf', textAlign: 'center' }}
          />
        </>
      ) : null}
    </>
  );
}

export function GridRaceScene() {
  const phase = useGridRaceStore((state) => state.phase);
  const simulation = useGridRaceStore((state) => state.simulation);
  const lastTurnSerial = useRef(gridRace.getState().turnSerial);
  const lastBoostPulseSerial = useRef(gridRace.getState().boostPulseSerial);
  const boostPulseRemaining = useRef(0);
  const playerWasAlive = useRef(true);
  const viewTag = useViroVRViewTag();

  const startRace = useCallback(() => {
    const input = gridRace.getState();
    gridRace.startRace();
    lastTurnSerial.current = input.turnSerial;
    lastBoostPulseSerial.current = input.boostPulseSerial;
    boostPulseRemaining.current = 0;
    playerWasAlive.current = true;
  }, []);

  useEffect(() => {
    const alive = simulation.riders.player.alive;
    if (playerWasAlive.current && !alive) {
      triggerViroHaptic(viewTag, {
        hand: 'both',
        amplitude: 0.9,
        durationSec: 0.16,
      });
    }
    playerWasAlive.current = alive;
  }, [simulation.riders.player.alive, viewTag]);

  const onFixedUpdate = useCallback(({ dt }: { dt: number }) => {
    if (phase !== 'race') return;

    const input = gridRace.getState();
    let turn: GridTurn = 0;

    if (input.turnSerial !== lastTurnSerial.current) {
      turn = input.turn;
      lastTurnSerial.current = input.turnSerial;
    }

    if (input.boostPulseSerial !== lastBoostPulseSerial.current) {
      boostPulseRemaining.current = 0.72;
      lastBoostPulseSerial.current = input.boostPulseSerial;
    }

    boostPulseRemaining.current = Math.max(0, boostPulseRemaining.current - dt);
    const boost = input.boostHeld || boostPulseRemaining.current > 0;

    gridRace.advanceSimulation({ turn, boost }, dt);
  }, [phase]);

  return (
    <ViroScene>
      <ViroAmbientLight color="#7cf8ff" intensity={125} />
      <ViroDirectionalLight color="#ff9b33" intensity={165} direction={[0, -1, -0.35]} />
      <ViroGameLoop fixedHz={30} onFixedUpdate={onFixedUpdate} />

      {phase === 'gateway' ? (
        <Gateway onStart={startRace} />
      ) : (
        <RaceWorld
          simulation={simulation}
          onRestart={gridRace.restartSimulation}
        />
      )}
    </ViroScene>
  );
}
