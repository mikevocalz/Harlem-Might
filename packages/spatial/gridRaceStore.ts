'use client';

import { create } from 'zustand';
import {
  advanceGridRace,
  createGridRaceSimulation,
  restartGridRace,
  type GridRaceSimulation,
  type GridTurn,
} from './gridRaceEngine';

export type GridRacePhase = 'gateway' | 'race';

type GridRaceState = {
  phase: GridRacePhase;
  simulation: GridRaceSimulation;
  steer: number;
  throttle: number;
  turn: GridTurn;
  turnSerial: number;
  boostHeld: boolean;
  boostPulseSerial: number;
  setStick: (x: number, y: number) => void;
  queueTurn: (turn: Exclude<GridTurn, 0>) => void;
  setBoost: (active: boolean) => void;
  pulseBoost: () => void;
  enterGateway: () => void;
  startRace: () => void;
  advanceSimulation: (input: { turn: GridTurn; boost: boolean }, dt: number) => void;
  restartSimulation: () => void;
  resetInput: () => void;
};

const TURN_TRIGGER = 0.62;
const TURN_RELEASE = 0.34;
const BOOST_TRIGGER = 0.58;
const clampStick = (value: number) => Math.max(-1, Math.min(1, value));

export const useGridRaceStore = create<GridRaceState>((set) => {
  // Remember release across intermediate analog samples, not just one frame.
  let turnReady = true;
  const neutralInput = () => {
    turnReady = true;
    return { steer: 0, throttle: 0, turn: 0 as const, boostHeld: false };
  };

  return {
    phase: 'gateway',
    simulation: createGridRaceSimulation(),
    ...neutralInput(),
    turnSerial: 0,
    boostPulseSerial: 0,

    setStick: (x, y) =>
      set((state) => {
        const steer = clampStick(x);
        const throttle = clampStick(y);
        if (Math.abs(steer) <= TURN_RELEASE) turnReady = true;
        const crossedTurnGate = turnReady && Math.abs(steer) >= TURN_TRIGGER;
        if (crossedTurnGate) turnReady = false;
        const queuedTurn: GridTurn =
          crossedTurnGate ? (steer < 0 ? -1 : 1) : state.turn;

        return {
          steer,
          throttle,
          boostHeld: throttle >= BOOST_TRIGGER,
          turn: queuedTurn,
          turnSerial:
            crossedTurnGate ? state.turnSerial + 1 : state.turnSerial,
        };
      }),

    queueTurn: (turn) =>
      set((state) => ({
        turn,
        turnSerial: state.turnSerial + 1,
      })),

    setBoost: (active) => set({ boostHeld: active }),
    pulseBoost: () =>
      set((state) => ({ boostPulseSerial: state.boostPulseSerial + 1 })),

    enterGateway: () =>
      set({
        phase: 'gateway',
        ...neutralInput(),
      }),

    startRace: () =>
      set({
        phase: 'race',
        simulation: createGridRaceSimulation(),
        ...neutralInput(),
      }),

    advanceSimulation: (input, dt) =>
      set((state) => ({
        simulation: advanceGridRace(state.simulation, input, dt),
      })),

    restartSimulation: () =>
      set((state) => ({
        simulation: restartGridRace(state.simulation),
        ...neutralInput(),
      })),

    resetInput: () => set(neutralInput()),
  };
});

export const gridRace = {
  getState: useGridRaceStore.getState,
  enterGateway: () => useGridRaceStore.getState().enterGateway(),
  startRace: () => useGridRaceStore.getState().startRace(),
  setStick: (x: number, y: number) => useGridRaceStore.getState().setStick(x, y),
  queueTurn: (turn: Exclude<GridTurn, 0>) => useGridRaceStore.getState().queueTurn(turn),
  setBoost: (active: boolean) => useGridRaceStore.getState().setBoost(active),
  pulseBoost: () => useGridRaceStore.getState().pulseBoost(),
  advanceSimulation: (input: { turn: GridTurn; boost: boolean }, dt: number) =>
    useGridRaceStore.getState().advanceSimulation(input, dt),
  restartSimulation: () => useGridRaceStore.getState().restartSimulation(),
  resetInput: () => useGridRaceStore.getState().resetInput(),
};
