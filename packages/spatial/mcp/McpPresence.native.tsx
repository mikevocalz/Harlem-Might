'use client';

import {
  Viro3DObject,
  ViroAnimations,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroText,
} from '../viro';
import type {
  LightCycleMatchState,
  LightCyclePlayerId,
} from '../lightcycle/tabletopCore';
import { deriveMcpPresentation } from './mcpBrain';
import { deriveMcpVoiceCue } from './mcpVoice';

type Props = {
  state: LightCycleMatchState;
  localPlayerId: LightCyclePlayerId;
  assetSource?: number | { uri: string };
};

type Vec3 = [number, number, number];

ViroAnimations.registerAnimations({
  mcpPresencePulse: {
    properties: {
      scaleX: 1.035,
      scaleY: 1.035,
      scaleZ: 1.035,
      opacity: 0.9,
    },
    duration: 720,
    easing: 'EaseInEaseOut',
  },
  mcpPresenceAlert: [
    {
      properties: {
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        opacity: 0.82,
      },
      duration: 120,
    },
    {
      properties: {
        scaleX: 1.075,
        scaleY: 1.075,
        scaleZ: 1.075,
        opacity: 1,
      },
      duration: 260,
      easing: 'EaseInEaseOut',
    },
  ],
});

ViroMaterials.createMaterials({
  mcpChrome: {
    diffuseColor: '#050609',
    lightingModel: 'Phong',
  },
  mcpRed: {
    diffuseColor: '#ff2b1c',
    lightingModel: 'Constant',
  },
  mcpWhite: {
    diffuseColor: '#f5f2eb',
    lightingModel: 'Constant',
  },
  mcpGlass: {
    diffuseColor: 'rgba(24,3,2,0.72)',
    lightingModel: 'Constant',
    blendMode: 'Alpha',
    cullMode: 'None',
  },
});

function arcPoints(
  radius: number,
  startRadians: number,
  endRadians: number,
  z: number,
  steps = 28,
): Vec3[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const angle = startRadians + (endRadians - startRadians) * t;
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      z,
    ] as Vec3;
  });
}

const HALO_A = arcPoints(0.17, -Math.PI * 0.82, Math.PI * 0.82, -0.055);
const HALO_B_LEFT = arcPoints(
  0.205,
  Math.PI * 0.57,
  Math.PI * 1.42,
  -0.072,
  20,
);
const HALO_B_RIGHT = arcPoints(
  0.205,
  -Math.PI * 0.43,
  Math.PI * 0.42,
  -0.072,
  20,
);

export function McpPresence({
  state,
  localPlayerId,
  assetSource,
}: Props) {
  const presentation = deriveMcpPresentation(state, localPlayerId);
  const voiceCue = deriveMcpVoiceCue(state, localPlayerId);
  const headRotation =
    voiceCue?.expression === 'amused'
      ? [-2, 4, 3]
      : voiceCue?.expression === 'threat'
        ? [-4, 0, 0]
        : voiceCue?.expression === 'shock'
          ? [-7, 0, 0]
          : voiceCue?.expression === 'triumph'
            ? [2, -4, -2]
            : voiceCue?.expression === 'final'
              ? [3, 0, 0]
              : [0, 0, 0];
  const alert =
    presentation.mood === 'derez' ||
    presentation.mood === 'warning' ||
    presentation.mood === 'match-victory' ||
    voiceCue?.expression === 'threat' ||
    voiceCue?.expression === 'shock' ||
    voiceCue?.expression === 'final';

  return (
    <ViroNode
      position={[0, 0.49, -0.33]}
      animation={{
        name: alert ? 'mcpPresenceAlert' : 'mcpPresencePulse',
        loop: true,
        run: true,
      }}
    >
      <ViroPolyline
        points={HALO_A}
        thickness={0.008}
        materials={['mcpRed']}
      />
      <ViroPolyline
        points={HALO_B_LEFT}
        thickness={0.004}
        materials={['mcpWhite']}
      />
      <ViroPolyline
        points={HALO_B_RIGHT}
        thickness={0.004}
        materials={['mcpWhite']}
      />

      {([-0.245, -0.205, -0.17, 0.17, 0.205, 0.245] as number[]).map(
        (x, index) => (
          <ViroBox
            key={'mcp-spine-' + index}
            position={[x, index === 0 || index === 5 ? 0.04 : 0, -0.07]}
            scale={[
              0.007,
              index === 0 || index === 5
                ? 0.17
                : index === 1 || index === 4
                  ? 0.13
                  : 0.1,
              0.007,
            ]}
            materials={['mcpChrome']}
          />
        ),
      )}

      <ViroBox
        position={[0, 0.08, -0.08]}
        scale={[0.006, 0.2, 0.006]}
        materials={['mcpRed']}
      />

      <ViroNode rotation={headRotation as [number, number, number]}>
        {assetSource ? (
          <Viro3DObject
            source={assetSource}
            type="GLB"
            position={[0, 0, 0]}
            scale={[1, 1, 1]}
          />
        ) : (
          <ViroNode>
          <ViroBox
            position={[0, 0.01, 0]}
            scale={[0.09, 0.125, 0.064]}
            materials={['mcpChrome']}
          />
          <ViroBox
            position={[0, -0.09, 0.018]}
            scale={[0.07, 0.038, 0.055]}
            materials={['mcpChrome']}
          />
          <ViroBox
            position={[-0.04, 0.03, 0.07]}
            rotation={[0, 0, -5]}
            scale={[0.022, 0.006, 0.008]}
            materials={['mcpRed']}
          />
          <ViroBox
            position={[0.04, 0.03, 0.07]}
            rotation={[0, 0, 5]}
            scale={[0.022, 0.006, 0.008]}
            materials={['mcpRed']}
          />
          <ViroBox
            position={[0, 0.06, 0.064]}
            scale={[0.07, 0.004, 0.006]}
            materials={['mcpWhite']}
          />
          </ViroNode>
        )}
      </ViroNode>

      {[-0.17, -0.21, -0.25].map((y, index) => (
        <ViroPolyline
          key={'mcp-core-ring-' + index}
          points={arcPoints(
            0.1 + index * 0.018,
            0,
            Math.PI * 2,
            -0.02,
            30,
          ).map(
            ([x, ringY, z]) => [x, y, ringY * 0.3 + z] as Vec3,
          )}
          thickness={0.004}
          materials={['mcpRed']}
        />
      ))}

      <ViroBox
        position={[0, -0.31, 0]}
        scale={[0.055, 0.085, 0.055]}
        rotation={[0, 0, 45]}
        materials={['mcpChrome']}
      />
      <ViroBox
        position={[0, -0.31, 0.058]}
        scale={[0.005, 0.085, 0.005]}
        materials={['mcpRed']}
      />

      <ViroText
        text={presentation.headline}
        position={[0, -0.405, 0.02]}
        width={0.56}
        height={0.065}
        style={{
          fontSize: 10,
          color: '#ff3b2c',
          textAlign: 'center',
          fontWeight: '700',
        }}
      />
      <ViroText
        text={presentation.detail}
        position={[0, -0.45, 0.02]}
        width={0.65}
        height={0.05}
        style={{
          fontSize: 7,
          color: '#f5f2eb',
          textAlign: 'center',
        }}
      />
    </ViroNode>
  );
}
