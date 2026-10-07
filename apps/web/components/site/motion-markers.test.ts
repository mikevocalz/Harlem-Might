import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BENTO_REVEAL,
  MOTION_MARKER_SELECTOR,
  bentoModuleName,
  bentoRevealPlan,
  bentoTriggerName,
  countBentoModules,
  parseBentoTrigger,
  parseMotionMarker,
  unboundFades,
} from './motion-markers.ts';

describe('parseMotionMarker', () => {
  it('classifies each marker prefix', () => {
    assert.deepEqual(parseMotionMarker('mfx-hero-title'), { kind: 'fade', name: 'hero-title' });
    assert.deepEqual(parseMotionMarker('mpx-hero-map'), { kind: 'scrub', name: 'hero-map' });
    assert.deepEqual(parseMotionMarker('trg-hero'), { kind: 'trigger', name: 'hero' });
  });

  it('returns null for non-marker ids and bare prefixes', () => {
    assert.equal(parseMotionMarker('hero-title'), null);
    assert.equal(parseMotionMarker(''), null);
    assert.equal(parseMotionMarker('mfx-'), null);
    assert.equal(parseMotionMarker('mpx-'), null);
    assert.equal(parseMotionMarker('trg-'), null);
  });

  it('keeps the longest matching semantics — prefixes do not overlap', () => {
    assert.equal(parseMotionMarker('mfx-mpx-nested')?.kind, 'fade');
  });
});

describe('MOTION_MARKER_SELECTOR', () => {
  it('covers every marker prefix', () => {
    assert.match(MOTION_MARKER_SELECTOR, /mfx-/);
    assert.match(MOTION_MARKER_SELECTOR, /mpx-/);
    assert.match(MOTION_MARKER_SELECTOR, /trg-/);
  });
});

describe('bento group markers', () => {
  // The literal ids MightsPlaceBento emits for motionKey="block-places" and 3 modules
  // (packages/ui/mights/MightsPlaceBento.tsx:bentoMotionIds).
  const emitted = {
    trigger: 'trg-bento-block-places',
    modules: ['mfx-bento-block-places-0', 'mfx-bento-block-places-1', 'mfx-bento-block-places-2'],
  };

  it('parses the ids the bento emits into one trigger and indexed entrances', () => {
    const trigger = parseMotionMarker(emitted.trigger);
    assert.deepEqual(trigger, { kind: 'trigger', name: bentoTriggerName('block-places') });
    assert.equal(parseBentoTrigger(trigger!.name), 'block-places');
    emitted.modules.forEach((id, i) => {
      assert.deepEqual(parseMotionMarker(id), { kind: 'fade', name: bentoModuleName('block-places', i) });
    });
  });

  it('ignores non-bento triggers and an empty key', () => {
    assert.equal(parseBentoTrigger('places'), null);
    assert.equal(parseBentoTrigger('bento-'), null);
  });

  it('counts contiguous modules only, so a gap never binds a stray index', () => {
    const names = ['bento-a-0', 'bento-a-1', 'bento-a-3', 'bento-ab-0', 'hero-title'];
    assert.equal(countBentoModules('a', names), 2);
    assert.equal(countBentoModules('ab', names), 1);
    assert.equal(countBentoModules('missing', names), 0);
  });

  it('reveals the dominant module first, then supports in source order', () => {
    const plan = bentoRevealPlan('k', 4);
    assert.deepEqual(
      plan.map((s) => s.target),
      ['bento-k-0', 'bento-k-1', 'bento-k-2', 'bento-k-3'],
    );
    assert.equal(plan[0]!.atMs, 0);
    assert.equal(plan[0]!.durationMs, BENTO_REVEAL.dominantMs);
    assert.ok(plan[0]!.fromY > plan[1]!.fromY, 'dominant travels further');
    for (let i = 1; i < plan.length; i += 1) {
      assert.ok(plan[i]!.atMs > plan[i - 1]!.atMs, `module ${i} starts after module ${i - 1}`);
    }
    assert.equal(plan[1]!.atMs, BENTO_REVEAL.supportStartMs);
    assert.equal(plan[3]!.atMs - plan[2]!.atMs, BENTO_REVEAL.supportStaggerMs);
  });

  it('plans nothing for an empty bento', () => {
    assert.deepEqual(bentoRevealPlan('k', 0), []);
  });
});

describe('unboundFades', () => {
  it('returns pre-hidden markers that no bound motion claimed', () => {
    const fades = ['hero-title', 'bento-places-0', 'bento-places-1', 'close-title'];
    assert.deepEqual(unboundFades(fades, new Set(['bento-places-0', 'close-title'])), ['bento-places-1']);
  });

  it('never returns hero markers, which CSS does not pre-hide', () => {
    assert.deepEqual(unboundFades(['hero-title', 'hero-lens'], new Set()), []);
  });
});
