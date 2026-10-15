import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { registerHooks } from 'node:module';
import { advanceGridRace, createGridRaceSimulation } from './gridRaceEngine.ts';

// Resolve the production store's bundler-style import for Node's TS test runner.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './gridRaceEngine') return next('./gridRaceEngine.ts', context);
    return next(specifier, context);
  },
});
const { gridRace, useGridRaceStore } = await import('./gridRaceStore.ts');
hooks.deregister();

beforeEach(() => {
  useGridRaceStore.setState(useGridRaceStore.getInitialState(), true);
  gridRace.resetInput();
});
afterEach(() => gridRace.resetInput());

function dirtyInput() {
  gridRace.setStick(1, 1);
  gridRace.queueTurn(-1);
  gridRace.setBoost(true);
  gridRace.pulseBoost();
}

function assertNeutralInput() {
  const state = gridRace.getState();
  assert.equal(state.steer, 0);
  assert.equal(state.throttle, 0);
  assert.equal(state.turn, 0);
  assert.equal(state.boostHeld, false);
}

describe('grid race production input store', () => {
  for (const sign of [-1, 1] as const) {
    it(`turns ${sign} once when a gradual stick movement reaches the trigger`, () => {
      for (const magnitude of [0.2, 0.4, 0.61]) gridRace.setStick(sign * magnitude, 0);
      assert.equal(gridRace.getState().turnSerial, 0);
      gridRace.setStick(sign * 0.62, 0);
      assert.equal(gridRace.getState().turn, sign);
      assert.equal(gridRace.getState().turnSerial, 1);
      for (const magnitude of [0.8, 1, 0.5, 0.62]) gridRace.setStick(sign * magnitude, 0);
      assert.equal(gridRace.getState().turnSerial, 1, 'holding or jittering does not repeat');
    });
  }

  it('rearms at the release threshold and stays armed through the hysteresis band', () => {
    gridRace.setStick(0.62, 0);
    gridRace.setStick(0.35, 0);
    gridRace.setStick(0.62, 0);
    assert.equal(gridRace.getState().turnSerial, 1);
    gridRace.setStick(0.34, 0);
    gridRace.setStick(0.5, 0);
    gridRace.setStick(0.62, 0);
    assert.equal(gridRace.getState().turnSerial, 2);
  });

  it('requires release before an opposite turn and recognizes a gradual negative release', () => {
    gridRace.setStick(1, 0);
    gridRace.setStick(-1, 0);
    assert.equal(gridRace.getState().turnSerial, 1);
    gridRace.setStick(-0.34, 0);
    gridRace.setStick(-0.5, 0);
    gridRace.setStick(-0.62, 0);
    assert.equal(gridRace.getState().turnSerial, 2);
    assert.equal(gridRace.getState().turn, -1);
  });

  it('clamps the stick and uses the inclusive positive throttle boost threshold', () => {
    gridRace.setStick(5, -5);
    assert.equal(gridRace.getState().steer, 1);
    assert.equal(gridRace.getState().throttle, -1);
    assert.equal(gridRace.getState().boostHeld, false);
    gridRace.setStick(-5, 0.579);
    assert.equal(gridRace.getState().steer, -1);
    assert.equal(gridRace.getState().boostHeld, false);
    gridRace.setStick(0, 0.58);
    assert.equal(gridRace.getState().boostHeld, true);
    gridRace.setStick(0, 5);
    assert.equal(gridRace.getState().throttle, 1);
    assert.equal(gridRace.getState().boostHeld, true);
    gridRace.setStick(0, 0);
    assert.equal(gridRace.getState().boostHeld, false);
  });

  it('queues each discrete turn and boost pulse while held boost stays independent', () => {
    gridRace.queueTurn(1);
    gridRace.queueTurn(1);
    gridRace.queueTurn(-1);
    assert.equal(gridRace.getState().turnSerial, 3);
    assert.equal(gridRace.getState().turn, -1);
    assert.equal(gridRace.getState().steer, 0);
    gridRace.pulseBoost();
    gridRace.pulseBoost();
    assert.equal(gridRace.getState().boostPulseSerial, 2);
    assert.equal(gridRace.getState().boostHeld, false);
    gridRace.setBoost(true);
    assert.equal(gridRace.getState().boostHeld, true);
    gridRace.setBoost(false);
    assert.equal(gridRace.getState().boostHeld, false);
    assert.equal(gridRace.getState().boostPulseSerial, 2);
  });

  for (const action of ['enterGateway', 'startRace', 'restartSimulation', 'resetInput'] as const) {
    it(`${action} clears held/queued input and rearms the stick without rewinding event serials`, () => {
      gridRace.startRace();
      dirtyInput();
      const before = gridRace.getState();
      gridRace[action]();
      assertNeutralInput();
      const reset = gridRace.getState();
      // GridRaceScene compares these serials with refs; resetting them would
      // look like a new event to an already mounted consumer.
      assert.equal(reset.turnSerial, before.turnSerial);
      assert.equal(reset.boostPulseSerial, before.boostPulseSerial);
      gridRace.setStick(0.4, 0);
      gridRace.setStick(-0.62, 0);
      assert.equal(gridRace.getState().turnSerial, before.turnSerial + 1);
      assert.equal(gridRace.getState().turn, -1);
    });
  }

  it('starts from the gateway, restarts with a new seed and replaces old match state', () => {
    assert.equal(gridRace.getState().phase, 'gateway');
    gridRace.startRace();
    const old = gridRace.getState().simulation;
    assert.equal(gridRace.getState().phase, 'race');
    gridRace.advanceSimulation({ turn: 0, boost: false }, 0.1);
    assert.notEqual(gridRace.getState().simulation, old);
    gridRace.restartSimulation();
    assert.equal(gridRace.getState().phase, 'race');
    assert.deepEqual(gridRace.getState().simulation, createGridRaceSimulation(old.seed + 101));
    const restarted = gridRace.getState().simulation;
    gridRace.enterGateway();
    assert.equal(gridRace.getState().phase, 'gateway');
    assert.equal(gridRace.getState().simulation, restarted);
    gridRace.startRace();
    assert.deepEqual(gridRace.getState().simulation, createGridRaceSimulation());
  });

  it('advances the actual engine immutably and notifies subscribers with the new snapshot', () => {
    gridRace.startRace();
    const before = gridRace.getState();
    const input = Object.freeze({ turn: 1 as const, boost: true });
    const observed: ReturnType<typeof gridRace.getState>[] = [];
    const unsubscribe = useGridRaceStore.subscribe((state) => observed.push(state));
    try {
      gridRace.advanceSimulation(input, 0.1);
      const next = gridRace.getState();
      assert.deepEqual(next.simulation, advanceGridRace(before.simulation, input, 0.1));
      assert.equal(before.simulation.countdown, 3);
      assert.equal(next.simulation.countdown, 2.9);
      assert.deepEqual(observed, [next]);
      assert.equal(next.turnSerial, before.turnSerial);
      assert.equal(next.boostPulseSerial, before.boostPulseSerial);
    } finally {
      unsubscribe();
    }
  });
});
