import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createExpoLocationSource, type ExpoLocationApi } from './expoLocationSource.ts';
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function api(overrides: Partial<ExpoLocationApi> = {}): ExpoLocationApi { return {
  Accuracy: { High: 4 }, getForegroundPermissionsAsync: async () => ({ status: 'granted' }), requestForegroundPermissionsAsync: async () => ({ status: 'granted' }), hasServicesEnabledAsync: async () => true,
  watchPositionAsync: async () => ({ remove() {} }), watchHeadingAsync: async () => ({ remove() {} }), ...overrides,
}; }
describe('foreground Expo location adapter', () => {
  it('checking permission never prompts', async () => {
    let requests = 0; const source = createExpoLocationSource(api({ requestForegroundPermissionsAsync: async () => { requests++; return { status: 'granted' }; } }));
    assert.equal(await source.check(), 'granted'); assert.equal(requests, 0);
  });
  it('does not prompt after cancellation during an outstanding services check', async () => {
    let resolve!: (enabled: boolean) => void; let requests = 0;
    const source = createExpoLocationSource(api({ hasServicesEnabledAsync: () => new Promise(r => { resolve = r; }), requestForegroundPermissionsAsync: async () => { requests++; return { status: 'granted' }; } }));
    const stop = source.watch({ onAvailability() {}, onFix() {} }); stop(); resolve(true); await flush(); assert.equal(requests, 0);
  });
  it('denial leaves browsing usable and starts no sensor subscription', async () => {
    let watched = 0; const statuses: string[] = [];
    const source = createExpoLocationSource(api({ requestForegroundPermissionsAsync: async () => ({ status: 'denied' }), watchPositionAsync: async () => { watched++; return { remove() {} }; } }));
    const stop = source.watch({ onAvailability: value => statuses.push(value), onFix() {} }); await flush(); stop();
    assert.equal(watched, 0); assert.deepEqual(statuses, ['denied']);
  });
  it('cancellation during subscription creation disposes the late subscription', async () => {
    let resolve!: (subscription: { remove(): void }) => void; let removed = 0; let heading = 0;
    const source = createExpoLocationSource(api({ watchPositionAsync: () => new Promise(r => { resolve = r; }), watchHeadingAsync: async () => { heading++; return { remove() {} }; } }));
    const stop = source.watch({ onAvailability() {}, onFix() {}, onHeading() {} }); await flush(); stop(); resolve({ remove() { removed++; } }); await flush();
    assert.equal(removed, 1); assert.equal(heading, 0);
  });
  it('ignores missing accuracy and reports precise real timestamped fixes only', async () => {
    let position!: Parameters<ExpoLocationApi['watchPositionAsync']>[1]; const fixes: unknown[] = [];
    const source = createExpoLocationSource(api({ watchPositionAsync: async (_options, next) => { position = next; return { remove() {} }; } }));
    const stop = source.watch({ onAvailability() {}, onFix: fix => fixes.push(fix) }); await flush();
    const coords = { latitude: 40.8, longitude: -73.95, accuracy: null, altitudeAccuracy: null, heading: null, speed: null };
    position({ coords, timestamp: 1000 }); assert.equal(fixes.length, 0);
    position({ coords: { ...coords, accuracy: 5 }, timestamp: 1001 });
    assert.deepEqual(fixes[0], { coordinate: { latitude: 40.8, longitude: -73.95 }, accuracy: { horizontalM: 5 }, timestampMs: 1001, source: 'device-gps' });
    stop(); position({ coords: { ...coords, accuracy: 5 }, timestamp: 1002 }); assert.equal(fixes.length, 1);
  });
});
