import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Fragment, type ReactElement, type ReactNode } from 'react';
import type { MetaWindowProps } from '@viro-external/meta-layout';
import { createMetaWindows, type MetaLayoutModules } from './metaWindowsCore.ts';
import { RAIL_WINDOW } from './railWindow.ts';

const SpatialWindow = () => null;
const SpatialSceneProvider = () => null;
const WindowOwners = () => null;

function fakeModules(): MetaLayoutModules {
  return {
    layout: {
      SpatialSceneProvider,
      useSpatialScene: () => ({ isSpatialAvailable: true }),
    },
    window: {
      SpatialWindow,
      createWindowScene: () => ({}),
      useSpatialWindowState: () => ({ placement: 'spatial' }),
    },
    windowOwners: WindowOwners,
  };
}

const props = { label: 'discover', windowWidth: 480, windowHeight: 720 } as MetaWindowProps;
const content = 'content';

type Element = ReactElement<{ children?: ReactNode; style?: unknown }>;

describe('metaWindows.Window', () => {
  it('wraps the content in windowOwners inside SpatialWindow when the SDK is linked', () => {
    const windows = createMetaWindows(true, fakeModules);
    const outer = windows.Window({ window: props, children: content }) as Element;

    assert.equal(windows.linked, true);
    assert.equal(outer.type, SpatialWindow);
    assert.equal((outer.props as { label?: string }).label, 'discover');

    const inner = outer.props.children as Element;
    assert.equal(inner.type, WindowOwners);
    assert.deepEqual(inner.props.style, { flex: 1 });
    assert.equal(inner.props.children, content);
  });

  it('passes the physical-left rail placement to Meta without a host override', () => {
    const windows = createMetaWindows(true, fakeModules);
    const outer = windows.Window({ window: RAIL_WINDOW, children: content }) as ReactElement<MetaWindowProps>;
    assert.equal(outer.type, SpatialWindow);
    assert.deepEqual(outer.props.anchor, { parent: 'left', child: 'right' });
    for (const key of ['label', 'windowWidth', 'windowHeight', 'priority', 'promotable', 'fallback', 'offset'] as const) {
      assert.equal(outer.props[key], RAIL_WINDOW[key]);
    }
  });

  it('renders the content in a fragment, unwrapped, when the SDK is not enabled', () => {
    let loaded = false;
    const windows = createMetaWindows(false, () => {
      loaded = true;
      return fakeModules();
    });
    const outer = windows.Window({ window: props, children: content }) as Element;

    assert.equal(loaded, false);
    assert.equal(windows.linked, false);
    assert.equal(outer.type, Fragment);
    assert.equal(outer.props.children, content);
  });

  it('falls back to the unwrapped fragment when the SDK fails to load', () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const windows = createMetaWindows(true, () => {
        throw new Error('not linked');
      });
      const outer = windows.Window({ window: props, children: content }) as Element;
      assert.equal(windows.linked, false);
      assert.equal(outer.type, Fragment);
      assert.equal(outer.props.children, content);
    } finally {
      console.warn = originalWarn;
    }
  });
});
