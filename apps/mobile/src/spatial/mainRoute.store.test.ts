import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useMainRouteStore } from './mainRoute.store.ts';

describe('useMainRouteStore', () => {
  it('queues a push and a replace with fresh ids', () => {
    useMainRouteStore.getState().push('/explore-ar');
    const first = useMainRouteStore.getState().pending;
    assert.equal(first?.method, 'push');
    assert.equal(first?.url, '/explore-ar');
    useMainRouteStore.getState().replace('/explore');
    const second = useMainRouteStore.getState().pending;
    assert.equal(second?.method, 'replace');
    assert.ok(second && first && second.id > first.id);
  });

  it('clears only the request it was told about', () => {
    useMainRouteStore.getState().push('/a');
    const stale = useMainRouteStore.getState().pending!.id;
    useMainRouteStore.getState().push('/b');
    useMainRouteStore.getState().done(stale);
    assert.equal(useMainRouteStore.getState().pending?.url, '/b');
    useMainRouteStore.getState().done(useMainRouteStore.getState().pending!.id);
    assert.equal(useMainRouteStore.getState().pending, null);
  });
});
