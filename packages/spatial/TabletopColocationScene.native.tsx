'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ViroAnimations,
  ViroARPlaneSelector,
  ViroARScene,
  ViroAmbientLight,
  ViroBox,
  ViroDirectionalLight,
  ViroNode,
  ViroMaterials,
  ViroPolyline,
  ViroSharedFrame,
  ViroText,
  cloudAnchorFrameSource,
  isPico,
  isQuest,
  isVisionOS,
  metaSpatialAnchorFrameSource,
  invertTransform,
  parseLocationTransform,
  poseCsv,
  transformDirection,
  useViroColocation,
  useViroColocationRoom,
  useViroReplicatedState,
  worldToLocation,
} from './viro';
import { LIGHTCYCLE_REPLICATION_IDS } from './lightcycle/sessionProtocol';
import { TabletopRaceRuntime } from './TabletopRaceRuntime.native';
import { TabletopRiveScoreboard } from './TabletopRiveScoreboard.native';
import { gridFx } from './rive-fx/store';
import {
  tabletopSession,
  useTabletopSessionStore,
} from './tabletopSessionStore';

const API_KEY = process.env.EXPO_PUBLIC_REACTVISION_API_KEY ?? '';
const PROJECT_ID = process.env.EXPO_PUBLIC_REACTVISION_PROJECT_ID ?? '';
const PLATFORM_ENDPOINT =
  process.env.EXPO_PUBLIC_REACTVISION_ENDPOINT || undefined;
const RELAY_ENDPOINT =
  process.env.EXPO_PUBLIC_REACTVISION_RELAY_ENDPOINT || undefined;

const MAT_WIDTH = 1.24;
const MAT_DEPTH = 0.84;

type Vec3 = [number, number, number];

ViroAnimations.registerAnimations({
  gridMatPreviewPulse: {
    properties: { scaleX: 1.025, scaleY: 1.025, scaleZ: 1.025, opacity: 0.82 },
    duration: 720,
    easing: 'EaseInEaseOut',
  },
  gridMatScan: [
    {
      properties: { positionZ: -0.31, opacity: 0.25 },
      duration: 1,
    },
    {
      properties: { positionZ: 0.31, opacity: 1 },
      duration: 900,
      easing: 'Linear',
    },
  ],
});

ViroMaterials.createMaterials({
  raceCyan: { diffuseColor: '#00f3ff', lightingModel: 'Constant' },
  raceOrange: { diffuseColor: '#ff7a00', lightingModel: 'Constant' },
  raceWhite: { diffuseColor: '#fff6cf', lightingModel: 'Constant' },
  raceDark: { diffuseColor: '#020407', lightingModel: 'Constant' },
  placementPlane: {
    diffuseColor: 'rgba(0,243,255,0.18)',
    lightingModel: 'Constant',
    blendMode: 'Alpha',
    cullMode: 'None',
    writesToDepthBuffer: isQuest,
  },
  placementMat: {
    diffuseColor: 'rgba(2,4,7,0.92)',
    lightingModel: 'Constant',
  },
});

type SceneProps = {
  sceneNavigator?: any;
  arSceneNavigator?: any;
};

function readVec3(value: unknown): Vec3 | null {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((item) => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    return null;
  }
  return [value[0], value[1], value[2]];
}

function sameVec3(a: unknown, b: Vec3) {
  const current = readVec3(a);
  return (
    current !== null &&
    current[0] === b[0] &&
    current[1] === b[1] &&
    current[2] === b[2]
  );
}

function acceptsGameSurface(plane: any) {
  if (plane?.type !== 'plane') return false;
  const alignment = String(plane.alignment ?? '');
  if (alignment && !alignment.includes('Horizontal')) return false;

  const classification = String(plane.classification ?? 'Unknown');
  if (isQuest) {
    return classification === 'Floor' || classification === 'Table';
  }

  return (
    classification === 'Floor' ||
    classification === 'Table' ||
    classification === 'Unknown' ||
    classification === 'None'
  );
}

function GridMatVisual({
  placementPreview = false,
}: {
  placementPreview?: boolean;
}) {
  const xLines = [-0.42, -0.21, 0, 0.21, 0.42];
  const zLines = [-0.28, -0.14, 0, 0.14, 0.28];

  return (
    <ViroNode
      animation={
        placementPreview
          ? { name: 'gridMatPreviewPulse', loop: true, run: true }
          : undefined
      }
    >
      <ViroBox
        position={[0, 0.012, 0]}
        scale={[MAT_WIDTH / 2, 0.012, MAT_DEPTH / 2]}
        materials={['placementMat']}
      />

      <ViroPolyline
        points={[
          [-MAT_WIDTH / 2, 0.032, -MAT_DEPTH / 2],
          [MAT_WIDTH / 2, 0.032, -MAT_DEPTH / 2],
          [MAT_WIDTH / 2, 0.032, MAT_DEPTH / 2],
          [-MAT_WIDTH / 2, 0.032, MAT_DEPTH / 2],
          [-MAT_WIDTH / 2, 0.032, -MAT_DEPTH / 2],
        ]}
        thickness={0.012}
        materials={['raceCyan']}
      />

      {xLines.map((x) => (
        <ViroPolyline
          key={'x-' + x}
          points={[
            [x, 0.028, -MAT_DEPTH / 2],
            [x, 0.028, MAT_DEPTH / 2],
          ]}
          thickness={0.004}
          materials={['raceCyan']}
        />
      ))}

      {zLines.map((z) => (
        <ViroPolyline
          key={'z-' + z}
          points={[
            [-MAT_WIDTH / 2, 0.028, z],
            [MAT_WIDTH / 2, 0.028, z],
          ]}
          thickness={0.004}
          materials={['raceCyan']}
        />
      ))}

      {([
        [-MAT_WIDTH / 2, -MAT_DEPTH / 2],
        [MAT_WIDTH / 2, -MAT_DEPTH / 2],
        [-MAT_WIDTH / 2, MAT_DEPTH / 2],
        [MAT_WIDTH / 2, MAT_DEPTH / 2],
      ] as [number, number][]).map(([x, z], index) => (
        <ViroBox
          key={'corner-' + index}
          position={[x, 0.045, z]}
          scale={[0.055, 0.02, 0.055]}
          materials={['raceOrange']}
        />
      ))}

      {placementPreview ? (
        <ViroBox
          position={[0, 0.06, -0.31]}
          scale={[MAT_WIDTH / 2.15, 0.008, 0.012]}
          materials={['raceWhite']}
          animation={{ name: 'gridMatScan', loop: true, run: true }}
        />
      ) : null}

      <ViroText
        text={placementPreview ? 'GRID MAT PREVIEW' : 'CLASSIC GRID DUEL'}
        position={[0, 0.044, 0]}
        rotation={[-90, 0, 0]}
        width={0.8}
        height={0.12}
        style={{
          fontSize: 12,
          color: placementPreview ? '#ffb24a' : '#fff6cf',
          textAlign: 'center',
        }}
      />
    </ViroNode>
  );
}

function PlacementControls({
  surface,
  onConfirm,
  onMove,
}: {
  surface: string;
  onConfirm: () => void;
  onMove: () => void;
}) {
  return (
    <ViroNode>
      <GridMatVisual placementPreview />

      <ViroText
        text={'DETECTED ' + surface.toUpperCase()}
        position={[0, 0.17, -0.29]}
        rotation={[-90, 0, 0]}
        width={0.8}
        height={0.1}
        style={{ fontSize: 10, color: '#00f3ff', textAlign: 'center' }}
      />

      <ViroBox
        position={[-0.25, 0.12, 0.28]}
        scale={[0.19, 0.045, 0.085]}
        materials={['raceCyan']}
        onClick={onConfirm}
      />
      <ViroText
        text="LOCK GRID"
        position={[-0.25, 0.171, 0.28]}
        rotation={[-90, 0, 0]}
        width={0.34}
        height={0.08}
        style={{ fontSize: 9, color: '#020407', textAlign: 'center' }}
      />

      <ViroBox
        position={[0.25, 0.12, 0.28]}
        scale={[0.19, 0.045, 0.085]}
        materials={['raceOrange']}
        onClick={onMove}
      />
      <ViroText
        text="MOVE"
        position={[0.25, 0.171, 0.28]}
        rotation={[-90, 0, 0]}
        width={0.34}
        height={0.08}
        style={{ fontSize: 9, color: '#020407', textAlign: 'center' }}
      />
    </ViroNode>
  );
}

function SharedTabletopRoom({
  roomId,
  hostPlacement,
}: {
  roomId: string;
  hostPlacement: import('./tabletopSessionStore').SharedPlacement | null;
}) {
  const mode = useTabletopSessionStore((state) => state.mode);
  const name = useTabletopSessionStore((state) => state.playerName);
  const ready = useTabletopSessionStore((state) => state.ready);
  const roomDisplayCode = useTabletopSessionStore(
    (state) => state.roomDisplayCode,
  );
  const localFrameLocalized = useTabletopSessionStore(
    (state) => state.localized,
  );
  const setReady = useTabletopSessionStore((state) => state.setReady);
  const localPlayerId = mode === 'host' ? 'p1' : 'p2';
  const remotePlayerId = localPlayerId === 'p1' ? 'p2' : 'p1';

  const colocated = useViroColocation({
    roomId,
    apiKey: API_KEY,
    projectId: PROJECT_ID,
    endpoint: RELAY_ENDPOINT,
    enabled: true,
  });

  const replication = useViroReplicatedState({
    roomId,
    apiKey: API_KEY,
    projectId: PROJECT_ID,
    endpoint: RELAY_ENDPOINT,
    enabled: true,
    onReject: (rejection) => {
      tabletopSession.setState({
        error: 'Replication rejected: ' + rejection.reason,
      });
    },
  });

  const placementId = LIGHTCYCLE_REPLICATION_IDS.placement;
  const placementEntity = replication.byId(placementId);
  const replicatedPlacement = readVec3(placementEntity?.fields.position);
  const placementPosition = hostPlacement?.position ?? replicatedPlacement;
  const placementSurface =
    hostPlacement?.surface ??
    (typeof placementEntity?.fields.surface === 'string'
      ? placementEntity.fields.surface
      : 'shared surface');
  const placementReady = placementPosition !== null;

  useEffect(() => {
    if (
      mode !== 'host' ||
      !hostPlacement ||
      replication.state !== 'synced'
    ) {
      return;
    }

    if (!placementEntity) {
      replication.claim(placementId);
      return;
    }

    if (!replication.isMine(placementId)) return;

    if (
      !sameVec3(placementEntity.fields.position, hostPlacement.position) ||
      placementEntity.fields.surface !== hostPlacement.surface ||
      placementEntity.fields.confirmed !== true
    ) {
      replication.set(
        placementId,
        {
          position: hostPlacement.position,
          surface: hostPlacement.surface,
          confirmed: true,
          widthMeters: MAT_WIDTH,
          depthMeters: MAT_DEPTH,
        },
        { optimistic: true },
      );
    }
  }, [
    hostPlacement,
    mode,
    placementEntity,
    placementId,
    replication,
  ]);

  const localEntityId = LIGHTCYCLE_REPLICATION_IDS.player(localPlayerId);
  const remoteEntityId = LIGHTCYCLE_REPLICATION_IDS.player(remotePlayerId);
  const localEntity = replication.byId(localEntityId);
  const remoteEntity = replication.byId(remoteEntityId);
  const p1Entity = replication.byId(LIGHTCYCLE_REPLICATION_IDS.player('p1'));
  const p2Entity = replication.byId(LIGHTCYCLE_REPLICATION_IDS.player('p2'));
  const snapshotEntity = replication.byId(
    LIGHTCYCLE_REPLICATION_IDS.snapshot,
  );
  const peers = colocated.peers.filter(
    (peer) => peer.peerId !== colocated.localPeerId,
  );
  const remotePeerLocalized = peers.some((peer) => peer.localized);
  const p1Ready =
    Boolean(p1Entity?.fields.ready) &&
    Boolean(p1Entity?.fields.localized) &&
    Boolean(p1Entity?.fields.connected);
  const p2Ready =
    Boolean(p2Entity?.fields.ready) &&
    Boolean(p2Entity?.fields.localized) &&
    Boolean(p2Entity?.fields.connected);
  const bothReady =
    placementReady &&
    colocated.state === 'joined' &&
    remotePeerLocalized &&
    p1Ready &&
    p2Ready;
  const playerNames = {
    p1:
      typeof p1Entity?.fields.name === 'string'
        ? p1Entity.fields.name
        : localPlayerId === 'p1'
          ? name
          : 'PLAYER 1',
    p2:
      typeof p2Entity?.fields.name === 'string'
        ? p2Entity.fields.name
        : localPlayerId === 'p2'
          ? name
          : 'PLAYER 2',
  };

  useEffect(() => {
    if (replication.state !== 'synced') return;
    if (!localEntity) {
      replication.claim(localEntityId);
      return;
    }
    if (!replication.isMine(localEntityId)) return;

    const fields = localEntity.fields ?? {};
    if (
      fields.name !== name ||
      fields.ready !== ready ||
      fields.localized !== true ||
      fields.connected !== true ||
      fields.peerId !== replication.localPeerId
    ) {
      replication.set(
        localEntityId,
        {
          playerId: localPlayerId,
          peerId: replication.localPeerId,
          name,
          ready,
          localized: localFrameLocalized && colocated.state === 'joined',
          connected: colocated.state === 'joined',
          cycleColor: localPlayerId === 'p1' ? 'cyan' : 'orange',
        },
        { optimistic: true },
      );
    }
  }, [
    localEntity,
    localEntityId,
    localPlayerId,
    name,
    ready,
    localFrameLocalized,
    colocated.state,
    replication,
  ]);

  useEffect(() => {
    if (mode !== 'host' || replication.state !== 'synced') return;
    const matchId = LIGHTCYCLE_REPLICATION_IDS.match;
    const match = replication.byId(matchId);
    if (!match) {
      replication.claim(matchId);
      return;
    }
    if (!replication.isMine(matchId)) return;

    const activePhase =
      match.fields.phase === 'countdown' ||
      match.fields.phase === 'running' ||
      match.fields.phase === 'round-over' ||
      match.fields.phase === 'match-over';
    if (activePhase) return;

    const nextPhase = bothReady ? 'ready' : 'lobby';
    if (
      match.fields.phase !== nextPhase ||
      match.fields.placementReady !== placementReady ||
      match.fields.p1Ready !== p1Ready ||
      match.fields.p2Ready !== p2Ready
    ) {
      replication.set(
        matchId,
        {
          phase: nextPhase,
          hostPeerId: replication.localPeerId,
          placementReady,
          p1Ready,
          p2Ready,
        },
        { optimistic: true },
      );
    }
  }, [
    bothReady,
    mode,
    p1Ready,
    p2Ready,
    placementReady,
    replication,
  ]);

  const remoteName =
    typeof remoteEntity?.fields.name === 'string'
      ? remoteEntity.fields.name
      : 'WAITING…';
  const remoteReady = Boolean(remoteEntity?.fields.ready);
  const localCanReady =
    localFrameLocalized &&
    colocated.state === 'joined' &&
    remotePeerLocalized &&
    placementReady;

  const syncFxSent = useRef(false);

  useEffect(() => {
    if (localCanReady && !syncFxSent.current) {
      syncFxSent.current = true;
      gridFx.emit({
        type: 'room-sync',
        intensity: 1,
        localPlayer: localPlayerId,
        playerColor: localPlayerId === 'p1' ? '#00f3ff' : '#ff7a00',
        opponentColor: localPlayerId === 'p1' ? '#ff7a00' : '#00f3ff',
      });
    } else if (!localCanReady) {
      syncFxSent.current = false;
    }
  }, [localCanReady, localPlayerId]);

  useEffect(() => {
    if (!localCanReady && ready) {
      setReady(false);
    }
  }, [localCanReady, ready, setReady]);

  useEffect(() => {
    const publish = (state: ReturnType<typeof useTabletopSessionStore.getState>) => {
      const transform = parseLocationTransform(state.sharedFrameTransform);
      const camera = state.cameraPose;
      if (!transform || !camera || colocated.state !== 'joined') return;

      const inverse = invertTransform(transform);
      const position = worldToLocation(transform, camera.position);
      if (!inverse || !position) return;

      const forward = transformDirection(inverse, camera.forward);
      const up = transformDirection(inverse, camera.up);
      colocated.publishPose(poseCsv(position, forward, up));
    };

    publish(useTabletopSessionStore.getState());
    return useTabletopSessionStore.subscribe((state, previous) => {
      if (
        state.cameraPose !== previous.cameraPose ||
        state.sharedFrameTransform !== previous.sharedFrameTransform
      ) {
        publish(state);
      }
    });
  }, [colocated.publishPose, colocated.state]);

  if (!placementPosition) {
    return (
      <ViroNode>
        <ViroText
          text="SYNCING HOST MAT POSE…"
          position={[0, 0.08, -0.7]}
          width={1.8}
          height={0.2}
          style={{ fontSize: 12, color: '#00f3ff', textAlign: 'center' }}
        />
      </ViroNode>
    );
  }

  return (
    <ViroNode position={placementPosition}>
      <GridMatVisual />
      <TabletopRaceRuntime
        roomId={roomId}
        replication={replication}
        localPlayerId={localPlayerId}
        placementReady={placementReady}
        playerNames={playerNames}
        bothReady={bothReady}
      />

      <TabletopRiveScoreboard
        replicatedState={snapshotEntity?.fields.state}
        joinCode={roomDisplayCode}
        presence={{
          p1: {
            name: playerNames.p1,
            ready: p1Ready,
            connected: Boolean(p1Entity?.fields.connected),
            localized: Boolean(p1Entity?.fields.localized),
          },
          p2: {
            name: playerNames.p2,
            ready: p2Ready,
            connected: Boolean(p2Entity?.fields.connected),
            localized: Boolean(p2Entity?.fields.localized),
          },
        }}
      />

      <ViroText
        text={
          'SHARED ' +
          placementSurface.toUpperCase() +
          ' · ' +
          replication.state.toUpperCase() +
          ' · PEERS ' +
          String(peers.length + 1)
        }
        position={[0, 0.085, -0.36]}
        rotation={[-90, 180, 0]}
        width={1.2}
        height={0.12}
        style={{ fontSize: 9, color: '#ff8a00', textAlign: 'center' }}
      />

      <ViroBox
        position={
          localPlayerId === 'p1'
            ? [-0.38, 0.07, 0]
            : [0.38, 0.07, 0]
        }
        scale={[0.08, 0.035, 0.17]}
        materials={[localPlayerId === 'p1' ? 'raceCyan' : 'raceOrange']}
      />
      {remoteEntity ? (
        <ViroBox
          position={
            remotePlayerId === 'p1'
              ? [-0.38, 0.07, 0]
              : [0.38, 0.07, 0]
          }
          scale={[0.08, 0.035, 0.17]}
          materials={[remotePlayerId === 'p1' ? 'raceCyan' : 'raceOrange']}
        />
      ) : null}

      <ViroBox
        position={[0, 0.09, 0.28]}
        scale={[0.18, 0.04, 0.07]}
        materials={[ready ? 'raceCyan' : 'raceOrange']}
        onClick={() => {
          if (localCanReady) setReady(!ready);
          else {
            tabletopSession.setState({
              error:
                'Player 2 must be physically localized to the same Grid before Ready.',
            });
          }
        }}
      />
      <ViroText
        text={
          ready
            ? 'READY ✓'
            : localCanReady
              ? 'PRESS TO READY'
              : 'WAITING FOR CO-LOCATION'
        }
        position={[0, 0.137, 0.28]}
        rotation={[-90, 0, 0]}
        width={0.45}
        height={0.08}
        style={{ fontSize: 11, color: '#fff6cf', textAlign: 'center' }}
      />
    </ViroNode>
  );
}

export function TabletopColocationScene({
  sceneNavigator,
  arSceneNavigator,
}: SceneProps) {
  const selectorRef = useRef<any>(null);
  const detectedPlaneIds = useRef(new Set<string>());

  const mode = useTabletopSessionStore((state) => state.mode);
  const hostFrameRef = useTabletopSessionStore((state) => state.hostFrameRef);
  const joinCode = useTabletopSessionStore((state) => state.joinCode);
  const localized = useTabletopSessionStore((state) => state.localized);
  const setLocalized = useTabletopSessionStore((state) => state.setLocalized);
  const setRoomDisplayCode = useTabletopSessionStore(
    (state) => state.setRoomDisplayCode,
  );
  const setError = useTabletopSessionStore((state) => state.setError);

  const candidate = useTabletopSessionStore((state) => state.placementCandidate);
  const placementConfirmed = useTabletopSessionStore(
    (state) => state.placementConfirmed,
  );
  const detectedSurfaceCount = useTabletopSessionStore(
    (state) => state.detectedSurfaceCount,
  );
  const phoneCloudAnchorId = useTabletopSessionStore(
    (state) => state.phoneCloudAnchorId,
  );
  const phoneAnchorWorking = useTabletopSessionStore(
    (state) => state.phoneAnchorWorking,
  );
  const hostPlacement = useTabletopSessionStore((state) => state.hostPlacement);
  const setCandidate = useTabletopSessionStore(
    (state) => state.setPlacementCandidate,
  );
  const setPlacementConfirmed = useTabletopSessionStore(
    (state) => state.setPlacementConfirmed,
  );
  const setDetectedSurfaceCount = useTabletopSessionStore(
    (state) => state.setDetectedSurfaceCount,
  );
  const setPhoneCloudAnchorId = useTabletopSessionStore(
    (state) => state.setPhoneCloudAnchorId,
  );
  const setPhoneAnchorWorking = useTabletopSessionStore(
    (state) => state.setPhoneAnchorWorking,
  );
  const setHostPlacement = useTabletopSessionStore(
    (state) => state.setHostPlacement,
  );
  const setSharedFrameTransform = useTabletopSessionStore(
    (state) => state.setSharedFrameTransform,
  );
  const setCameraPose = useTabletopSessionStore((state) => state.setCameraPose);

  const navigator = arSceneNavigator ?? sceneNavigator;
  const configured = Boolean(API_KEY && PROJECT_ID);

  const confirmPlacement = useCallback(async () => {
    if (!candidate) return;

    setPlacementConfirmed(true);
    setError(null);
    gridFx.emit({
      type: 'mat-lock',
      intensity: 1,
      world: {
        x: candidate.worldPosition[0],
        y: candidate.worldPosition[1],
        z: candidate.worldPosition[2],
      },
    });

    if (isQuest) return;

    if (isPico) {
      setPlacementConfirmed(false);
      setError('Physical co-location is not available on PICO in this runtime.');
      return;
    }

    if (!navigator?.hostCloudAnchor) {
      setPlacementConfirmed(false);
      setError('This device does not expose cloud-anchor hosting.');
      return;
    }

    setPhoneAnchorWorking(true);
    try {
      const result = await navigator.hostCloudAnchor(candidate.anchorId, 1);
      if (!result?.success || !result.cloudAnchorId) {
        setPlacementConfirmed(false);
        setError(result?.error ?? 'Unable to publish the tabletop anchor.');
        return;
      }
      setPhoneCloudAnchorId(result.cloudAnchorId);
      setError(null);
    } catch (error) {
      setPlacementConfirmed(false);
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to publish the tabletop anchor.',
      );
    } finally {
      setPhoneAnchorWorking(false);
    }
  }, [candidate, navigator, setError]);

  const hostFrameSource = useMemo(() => {
    if (mode !== 'host' || !placementConfirmed) return null;
    if (isQuest && hostFrameRef) {
      return metaSpatialAnchorFrameSource(hostFrameRef, 'create');
    }
    if (!isQuest && !isPico && !isVisionOS && phoneCloudAnchorId) {
      return cloudAnchorFrameSource(phoneCloudAnchorId);
    }
    return null;
  }, [
    hostFrameRef,
    mode,
    phoneCloudAnchorId,
    placementConfirmed,
  ]);

  const hostRoomFrame =
    mode === 'host' && localized
      ? isQuest && hostFrameRef
        ? ({
            frameKind: 'meta_group',
            frameRef: hostFrameRef,
            name: 'Light Cycle Grid',
          } as const)
        : phoneCloudAnchorId
          ? ({
              frameKind: 'cloud_anchor',
              cloudAnchorId: phoneCloudAnchorId,
              name: 'Light Cycle Grid',
            } as const)
          : undefined
      : undefined;

  const room = useViroColocationRoom({
    apiKey: API_KEY,
    projectId: PROJECT_ID,
    endpoint: PLATFORM_ENDPOINT,
    host: hostRoomFrame,
    joinCode: mode === 'guest' ? joinCode : undefined,
    enabled:
      configured &&
      (mode === 'guest' || Boolean(hostRoomFrame)),
  });

  useEffect(() => {
    if (room.displayCode) setRoomDisplayCode(room.displayCode);
  }, [room.displayCode, setRoomDisplayCode]);

  useEffect(() => {
    if (room.status === 'failed') {
      setError(room.error ?? 'Unable to join the shared Grid.');
    }
  }, [room.error, room.status, setError]);

  const frameSource = mode === 'host' ? hostFrameSource : room.frameSource;
  const roomReady = Boolean(room.roomId && localized);

  let status = 'PREPARING GRID';
  if (!configured) status = 'CO-LOCATION CREDENTIALS MISSING';
  else if (isPico) status = 'PICO SHARED-FRAME MODE NOT AVAILABLE';
  else if (isVisionOS) status = 'VISIONOS SHARED-SPACE TRANSPORT NOT CONFIGURED';
  else if (mode === 'host' && !candidate) {
    status =
      detectedSurfaceCount > 0
        ? 'TAP A CYAN TABLE OR FLOOR'
        : 'SCANNING FOR TABLE / FLOOR…';
  } else if (mode === 'host' && candidate && !placementConfirmed) {
    status = 'PREVIEW MAT · LOCK OR MOVE';
  } else if (phoneAnchorWorking) {
    status = 'PUBLISHING TABLE ANCHOR…';
  } else if (frameSource && !localized) {
    status = 'LOCKING SHARED COORDINATE FRAME…';
  } else if (mode === 'guest' && room.status === 'working') {
    status = 'LOOKING UP GRID ROOM…';
  } else if (mode === 'guest' && room.frameSource && !localized) {
    status = 'LOCALIZING TO HOST GRID…';
  } else if (localized && !room.roomId) {
    status = 'CREATING ROOM CODE…';
  } else if (roomReady) {
    status = 'GRID FOUND · SHARED FRAME LOCKED';
  }

  return (
    <ViroARScene
      anchorDetectionTypes="planesHorizontal"
      toneMappingEnabled={false}
      onCameraTransformUpdate={(camera: any) => {
        const pose = camera?.cameraTransform ?? camera;
        if (!pose?.position || !pose?.forward || !pose?.up) return;
        setCameraPose({
          position: pose.position,
          forward: pose.forward,
          up: pose.up,
        });
      }}
      onAnchorFound={(anchor: any) =>
        selectorRef.current?.handleAnchorFound(anchor)
      }
      onAnchorUpdated={(anchor: any) =>
        selectorRef.current?.handleAnchorUpdated(anchor)
      }
      onAnchorRemoved={(anchor: any) => {
        if (!anchor) return;
        selectorRef.current?.handleAnchorRemoved(anchor);
        if (candidate?.anchorId === anchor.anchorId) {
          setCandidate(null);
          setPlacementConfirmed(false);
        }
      }}
    >
      <ViroAmbientLight color="#7cf8ff" intensity={120} />
      <ViroDirectionalLight
        color="#ff9b33"
        intensity={140}
        direction={[0, -1, -0.35]}
      />

      <ViroText
        text={status}
        position={[0, 0.18, -1.45]}
        width={2.9}
        height={0.3}
        style={{ fontSize: 18, color: '#fff6cf', textAlign: 'center' }}
      />

      {isQuest && mode === 'host' && !placementConfirmed ? (
        <ViroText
          text="QUEST: SURFACES COME FROM PHYSICAL SPACE / SPACE SETUP"
          position={[0, -0.05, -1.42]}
          width={2.8}
          height={0.2}
          style={{ fontSize: 10, color: '#00f3ff', textAlign: 'center' }}
        />
      ) : null}

      {mode === 'host' && !placementConfirmed && !isPico && !isVisionOS ? (
        <ViroARPlaneSelector
          ref={selectorRef}
          alignment="Horizontal"
          minWidth={0.65}
          minHeight={0.45}
          material="placementPlane"
          hideOverlayOnSelection={false}
          useActualShape
          onPlaneDetected={(plane: any) => {
            if (!acceptsGameSurface(plane)) return false;
            if (!detectedPlaneIds.current.has(plane.anchorId)) {
              detectedPlaneIds.current.add(plane.anchorId);
              setDetectedSurfaceCount(detectedPlaneIds.current.size);
            }
            return true;
          }}
          onPlaneSelected={(plane: any, tapPosition?: Vec3) => {
            if (!tapPosition) return;
            setCandidate({
              anchorId: plane.anchorId,
              worldPosition: tapPosition,
              surface: String(plane.classification ?? 'Unknown'),
            });
            setError(null);
          }}
          onPlaneRemoved={(anchorId: string) => {
            detectedPlaneIds.current.delete(anchorId);
            setDetectedSurfaceCount(detectedPlaneIds.current.size);
          }}
        >
          {candidate ? (
            <PlacementControls
              surface={candidate.surface}
              onConfirm={() => {
                void confirmPlacement();
              }}
              onMove={() => {
                setCandidate(null);
                setPlacementConfirmed(false);
                selectorRef.current?.reset();
              }}
            />
          ) : null}
        </ViroARPlaneSelector>
      ) : null}

      {frameSource && navigator ? (
        <ViroSharedFrame
          source={frameSource}
          arSceneNavigator={navigator}
          maxAttempts={3}
          onLocalized={(event: any) => {
            if (mode === 'host' && candidate) {
              const transform = parseLocationTransform(event.transform);
              const locationPosition = transform
                ? worldToLocation(transform, candidate.worldPosition)
                : null;

              if (!locationPosition) {
                setLocalized(false);
                setError(
                  'Shared frame localized, but the mat pose could not be converted into the shared coordinate frame.',
                );
                return;
              }

              setHostPlacement({
                position: [
                  locationPosition[0],
                  locationPosition[1],
                  locationPosition[2],
                ],
                surface: candidate.surface,
              });
            }

            setSharedFrameTransform(event.transform ?? null);
            setLocalized(true);
            setError(null);
          }}
          onLocalizeError={(error) => {
            setSharedFrameTransform(null);
            setLocalized(false);
            setError(error);
          }}
          placeholder={
            <ViroText
              text="ALIGNING SHARED TABLE…"
              position={[0, -0.05, -1.2]}
              width={2.4}
              height={0.25}
              style={{ fontSize: 14, color: '#00f3ff', textAlign: 'center' }}
            />
          }
        >
          {roomReady && room.roomId ? (
            <SharedTabletopRoom
              roomId={room.roomId}
              hostPlacement={hostPlacement}
            />
          ) : hostPlacement ? (
            <ViroNode position={hostPlacement.position}>
              <GridMatVisual />
            </ViroNode>
          ) : null}
        </ViroSharedFrame>
      ) : null}
    </ViroARScene>
  );
}
