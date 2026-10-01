'use client';

import { create } from 'zustand';
import { normalizePlayerName } from './lightcycle/tabletopCore';

export type TabletopSessionMode = 'idle' | 'host' | 'guest' | 'solo';
export type QuestSpatialPermission = 'checking' | 'granted' | 'denied';
export type TabletopVec3 = [number, number, number];

export type PlacementCandidate = {
  anchorId: string;
  worldPosition: TabletopVec3;
  surface: string;
};

export type SharedPlacement = {
  position: TabletopVec3;
  surface: string;
};

export type TabletopCameraPose = {
  position: TabletopVec3;
  forward: TabletopVec3;
  up: TabletopVec3;
};

type TabletopSessionState = {
  mode: TabletopSessionMode;
  spatialViewOpen: boolean;
  playerName: string;
  joinCode: string;
  hostFrameRef: string | null;
  localized: boolean;
  ready: boolean;
  roomDisplayCode: string | null;
  error: string | null;
  questSpatialPermission: QuestSpatialPermission;
  placementCandidate: PlacementCandidate | null;
  placementConfirmed: boolean;
  detectedSurfaceCount: number;
  phoneCloudAnchorId: string | null;
  phoneAnchorWorking: boolean;
  hostPlacement: SharedPlacement | null;
  sharedFrameTransform: string | null;
  cameraPose: TabletopCameraPose | null;

  setSpatialViewOpen: (open: boolean) => void;
  setPlayerName: (name: string) => void;
  setJoinCode: (code: string) => void;
  beginHost: () => boolean;
  beginGuest: () => boolean;
  beginSolo: () => boolean;
  setLocalized: (localized: boolean) => void;
  setReady: (ready: boolean) => void;
  setRoomDisplayCode: (code: string | null) => void;
  setError: (error: string | null) => void;
  setQuestSpatialPermission: (status: QuestSpatialPermission) => void;
  setPlacementCandidate: (candidate: PlacementCandidate | null) => void;
  setPlacementConfirmed: (confirmed: boolean) => void;
  setDetectedSurfaceCount: (count: number) => void;
  setPhoneCloudAnchorId: (id: string | null) => void;
  setPhoneAnchorWorking: (working: boolean) => void;
  setHostPlacement: (placement: SharedPlacement | null) => void;
  setSharedFrameTransform: (transform: string | null) => void;
  setCameraPose: (pose: TabletopCameraPose | null) => void;
  clearPlacement: () => void;
  reset: () => void;
};

function createUuid() {
  const cryptoObject = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array }
    | undefined;

  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();

  const bytes = new Uint8Array(16);
  if (cryptoObject?.getRandomValues) {
    cryptoObject.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

function normalizedCode(value: string) {
  return value.replace(/[\s-]+/g, '').toUpperCase().slice(0, 8);
}

const placementReset = {
  localized: false,
  ready: false,
  roomDisplayCode: null,
  questSpatialPermission: 'checking' as QuestSpatialPermission,
  placementCandidate: null,
  placementConfirmed: false,
  detectedSurfaceCount: 0,
  phoneCloudAnchorId: null,
  phoneAnchorWorking: false,
  hostPlacement: null,
  sharedFrameTransform: null,
  cameraPose: null,
};

export const useTabletopSessionStore = create<TabletopSessionState>((set, get) => ({
  mode: 'idle',
  spatialViewOpen: false,
  playerName: '',
  joinCode: '',
  hostFrameRef: null,
  error: null,
  ...placementReset,

  setSpatialViewOpen: (spatialViewOpen) => set({ spatialViewOpen }),
  setPlayerName: (name) =>
    set({
      playerName: Array.from(name.replace(/[\u0000-\u001F\u007F]/g, '')).slice(0, 16).join(''),
      error: null,
    }),
  setJoinCode: (joinCode) =>
    set({ joinCode: normalizedCode(joinCode), error: null }),

  beginHost: () => {
    const playerName = normalizePlayerName(get().playerName);
    if (!playerName) {
      set({ error: 'Enter your player name first.' });
      return false;
    }
    set({
      mode: 'host',
      spatialViewOpen: true,
      playerName,
      joinCode: '',
      hostFrameRef: createUuid(),
      error: null,
      ...placementReset,
    });
    return true;
  },

  beginGuest: () => {
    const state = get();
    const playerName = normalizePlayerName(state.playerName);
    const joinCode = normalizedCode(state.joinCode);
    if (!playerName) {
      set({ error: 'Enter your player name first.' });
      return false;
    }
    if (joinCode.length < 6) {
      set({ error: 'Enter the six-character table code.' });
      return false;
    }
    set({
      mode: 'guest',
      spatialViewOpen: true,
      playerName,
      joinCode,
      hostFrameRef: null,
      error: null,
      ...placementReset,
    });
    return true;
  },

  beginSolo: () => {
    const playerName = normalizePlayerName(get().playerName);
    if (!playerName) {
      set({ error: 'Enter your player name first.' });
      return false;
    }
    set({
      mode: 'solo',
      spatialViewOpen: true,
      playerName,
      joinCode: '',
      hostFrameRef: null,
      localized: true,
      ready: true,
      roomDisplayCode: null,
      error: null,
      questSpatialPermission: 'granted',
      placementCandidate: null,
      placementConfirmed: true,
      detectedSurfaceCount: 0,
      phoneCloudAnchorId: null,
      phoneAnchorWorking: false,
      hostPlacement: null,
      sharedFrameTransform: null,
      cameraPose: null,
    });
    return true;
  },

  setLocalized: (localized) =>
    set((state) => ({ localized, ready: localized ? state.ready : false })),
  setReady: (ready) =>
    set((state) => ({ ready: state.localized ? ready : false })),
  setRoomDisplayCode: (roomDisplayCode) => set({ roomDisplayCode }),
  setError: (error) => set({ error }),
  setQuestSpatialPermission: (questSpatialPermission) =>
    set({ questSpatialPermission }),
  setPlacementCandidate: (placementCandidate) => set({ placementCandidate }),
  setPlacementConfirmed: (placementConfirmed) => set({ placementConfirmed }),
  setDetectedSurfaceCount: (detectedSurfaceCount) =>
    set({ detectedSurfaceCount }),
  setPhoneCloudAnchorId: (phoneCloudAnchorId) => set({ phoneCloudAnchorId }),
  setPhoneAnchorWorking: (phoneAnchorWorking) => set({ phoneAnchorWorking }),
  setHostPlacement: (hostPlacement) => set({ hostPlacement }),
  setSharedFrameTransform: (sharedFrameTransform) =>
    set({ sharedFrameTransform }),
  setCameraPose: (cameraPose) => set({ cameraPose }),

  clearPlacement: () =>
    set({
      localized: false,
      ready: false,
      placementCandidate: null,
      placementConfirmed: false,
      detectedSurfaceCount: 0,
      phoneCloudAnchorId: null,
      phoneAnchorWorking: false,
      hostPlacement: null,
      sharedFrameTransform: null,
      cameraPose: null,
      roomDisplayCode: null,
      error: null,
    }),

  reset: () =>
    set({
      mode: 'idle',
      spatialViewOpen: false,
      joinCode: '',
      hostFrameRef: null,
      error: null,
      ...placementReset,
    }),
}));

export const tabletopSession = {
  getState: useTabletopSessionStore.getState,
  setState: useTabletopSessionStore.setState,
};
