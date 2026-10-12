import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import { projectNavRoute, type NavPlacement } from './navAr.ts';
import { useNavAr } from './navAr.store.ts';

afterEach(() => useNavAr.getState().reset());

it('recalibration clears spatial evidence, keeps the route and awareness acknowledgement', () => {
  const frame = projectNavRoute({ route: fixtureRoute('apollo-theater--sylvias-restaurant'),
    generation: 1, receivedAtMs: 0, alternatives: [] });
  const target: NavPlacement = { source: 'compass', confidence: 'high', heightReference: 'estimated-eye-height',
    placement: { position: [0, 0, 0], rotation: [0, 0, 0] }, yawAccuracyDeg: 6, solvedAtMs: 1000, solvedAtAlongM: 20 };
  const state = useNavAr.getState();
  state.setWorld({ frame, target, displayed: target.placement });
  state.setAlongM(20);
  state.acknowledgeAwareness();
  state.setCompassSamples(12);
  state.setObservations({ nowMs: 1000, cameraTimestampMs: 1000, headingTimestampMs: 1000, geospatialTimestampMs: 1000 });
  state.requestRecalibration();
  const next = useNavAr.getState();
  assert.equal(next.world?.frame, frame);
  assert.equal(next.world?.target, undefined);
  assert.equal(next.world?.displayed, undefined);
  assert.equal(next.calibrationRevision, 1);
  assert.equal(next.compassSamples, 0);
  assert.equal(next.alongM, 20);
  assert.equal(next.isAwarenessAcknowledged, true);
  assert.deepEqual(next.observations, { nowMs: 1000 });
  next.requestRecalibration();
  assert.equal(useNavAr.getState().calibrationRevision, 2);
});

it('closing the scene removes all placement/freshness evidence for the next visit', () => {
  useNavAr.getState().setObservations({ nowMs: 1000, cameraTimestampMs: 1000 });
  useNavAr.getState().requestRecalibration();
  useNavAr.getState().reset();
  assert.deepEqual(useNavAr.getState().observations, { nowMs: 0 });
  assert.equal(useNavAr.getState().calibrationRevision, 0);
  assert.equal(useNavAr.getState().world, undefined);
});
