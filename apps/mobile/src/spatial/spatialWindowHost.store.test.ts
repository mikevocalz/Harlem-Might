import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { MetaWindowProps } from '@viro-external/meta-layout';
import { useSpatialWindowHostStore } from './spatialWindowHost.store.ts';

const window = (label: string): MetaWindowProps => ({
  label,
  windowWidth: 140,
  windowHeight: 356,
  priority: 20,
  promotable: true,
  fallback: 'drop',
  anchor: { parent: 'start', child: 'end' },
});

describe('useSpatialWindowHostStore', () => {
  beforeEach(() => useSpatialWindowHostStore.setState({ windows: {} }));

  it('mounts a window under its label', () => {
    useSpatialWindowHostStore.getState().mount({ window: window('rail'), content: 'rail content' });
    assert.deepEqual(Object.keys(useSpatialWindowHostStore.getState().windows), ['rail']);
    assert.equal(useSpatialWindowHostStore.getState().windows.rail?.content, 'rail content');
  });

  it('replaces the content of a label that is already mounted', () => {
    const { mount } = useSpatialWindowHostStore.getState();
    mount({ window: window('rail'), content: 'first' });
    mount({ window: window('rail'), content: 'second' });
    assert.equal(Object.keys(useSpatialWindowHostStore.getState().windows).length, 1);
    assert.equal(useSpatialWindowHostStore.getState().windows.rail?.content, 'second');
  });

  it('unmounts one label and keeps the others', () => {
    const { mount, unmount } = useSpatialWindowHostStore.getState();
    mount({ window: window('rail'), content: null });
    mount({ window: window('place-detail'), content: null });
    unmount('rail');
    assert.deepEqual(Object.keys(useSpatialWindowHostStore.getState().windows), ['place-detail']);
  });

  it('ignores an unknown label without changing state', () => {
    const before = useSpatialWindowHostStore.getState().windows;
    useSpatialWindowHostStore.getState().unmount('missing');
    assert.equal(useSpatialWindowHostStore.getState().windows, before);
  });
});
