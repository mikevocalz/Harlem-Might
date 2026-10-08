import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveArMode, type ArModeFacts } from './arMode.ts';

const QUEST: ArModeFacts = {
  device: 'headset',
  geospatial: 'unavailable',
  wallAnchorIds: [],
  worldToTableScale: 2500,
  roomRadiusScale: 0.05,
};

describe('resolveArMode on Quest', () => {
  it('places tabletop on a table anchor', () => {
    const { mode, degraded } = resolveArMode('tabletop', { ...QUEST, tableAnchorId: 't1', floorAnchorId: 'f1' });
    assert.deepEqual(mode, {
      mode: 'tabletop',
      placement: { kind: 'table-anchor', sceneAnchorId: 't1' },
      worldToTableScale: 2500,
    });
    assert.deepEqual(degraded, []);
  });

  it('floor-places tabletop when there is no table and reports it', () => {
    const { mode, degraded } = resolveArMode('tabletop', { ...QUEST, floorAnchorId: 'f1' });
    assert.deepEqual(mode, { mode: 'tabletop', placement: { kind: 'floor' }, worldToTableScale: 2500 });
    assert.deepEqual(degraded, [
      { type: 'mode-degraded', requested: 'tabletop', resolved: 'tabletop', reason: 'no-table-anchor' },
    ]);
  });

  it('degrades room to tabletop without wall anchors', () => {
    const { mode, degraded } = resolveArMode('room', { ...QUEST, tableAnchorId: 't1', floorAnchorId: 'f1' });
    assert.equal(mode.mode, 'tabletop');
    assert.deepEqual(degraded, [
      { type: 'mode-degraded', requested: 'room', resolved: 'tabletop', reason: 'no-scene-anchors' },
    ]);
  });

  it('resolves room when walls and a floor exist', () => {
    const { mode, degraded } = resolveArMode('room', {
      ...QUEST,
      floorAnchorId: 'f1',
      wallAnchorIds: ['w1', 'w2'],
    });
    assert.deepEqual(mode, { mode: 'room', wallAnchorIds: ['w1', 'w2'], floorAnchorId: 'f1', radiusScale: 0.05 });
    assert.deepEqual(degraded, []);
  });

  it('never resolves street, even when told geospatial is available', () => {
    for (const geospatial of ['unavailable', 'gnss-only', 'vps'] as const) {
      const { mode, degraded } = resolveArMode('street', { ...QUEST, geospatial, tableAnchorId: 't1' });
      assert.equal(mode.mode, 'tabletop');
      assert.equal(degraded[0]?.reason, 'no-geospatial');
    }
  });

  it('reports both causes when street falls back to a floor', () => {
    const { mode, degraded } = resolveArMode('street', { ...QUEST, floorAnchorId: 'f1' });
    assert.deepEqual(mode, { mode: 'tabletop', placement: { kind: 'floor' }, worldToTableScale: 2500 });
    assert.deepEqual(
      degraded.map((event) => event.reason),
      ['no-geospatial', 'no-table-anchor'],
    );
  });
});

describe('resolveArMode on phones', () => {
  const PHONE: ArModeFacts = { ...QUEST, device: 'phone' };

  it('resolves street with VPS or GNSS-only positioning', () => {
    assert.deepEqual(resolveArMode('street', { ...PHONE, geospatial: 'vps' }).mode, {
      mode: 'street',
      positioning: 'geospatial-vps',
    });
    assert.deepEqual(resolveArMode('street', { ...PHONE, geospatial: 'gnss-only' }).mode, {
      mode: 'street',
      positioning: 'geospatial-gnss-only',
    });
  });

  it('allows tabletop with geospatial available', () => {
    const { mode, degraded } = resolveArMode('tabletop', { ...PHONE, geospatial: 'vps', tableAnchorId: 't1' });
    assert.equal(mode.mode, 'tabletop');
    assert.deepEqual(degraded, []);
  });

  it('degrades street to tabletop without geospatial', () => {
    const { mode, degraded } = resolveArMode('street', { ...PHONE, tableAnchorId: 't1' });
    assert.equal(mode.mode, 'tabletop');
    assert.equal(degraded[0]?.reason, 'no-geospatial');
  });

  it('passes preview through', () => {
    assert.deepEqual(resolveArMode('preview', PHONE), { mode: { mode: 'preview' }, degraded: [] });
  });
});
