import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationPresentation, navigationRailStyle, tabBarPositionForDirection } from './navigationPresentation.ts';

const phone = { isHorizon: false, isFoldable: false, isTablet: false, hardwareColumnWidth: 0 };
test('ordinary phones keep bottom tabs; window width cannot turn them into tablets', () => {
  assert.deepEqual(navigationPresentation(phone), { rail: false, position: 'bottom' });
});
test('foldables keep the right rail even on the compact cover display', () => {
  assert.deepEqual(navigationPresentation({ ...phone, isFoldable: true }), { rail: true, position: 'right' });
  assert.deepEqual(navigationPresentation({ ...phone, hardwareColumnWidth: 90 }), { rail: true, position: 'right' });
});
test('tablets retain the physical right rail', () => {
  assert.deepEqual(navigationPresentation({ ...phone, isTablet: true }), { rail: true, position: 'right' });
});
test('Horizon uses physical left navigation even while its detached window is unavailable', () => {
  assert.deepEqual(navigationPresentation({ ...phone, isHorizon: true }), { rail: true, position: 'left' });
});
test('spatial runtime capability takes precedence over flat-screen device classification', () => {
  for (const patch of [{}, { isTablet: true }, { isFoldable: true }, { hardwareColumnWidth: 90 }]) {
    assert.deepEqual(navigationPresentation({ ...phone, ...patch, isSpatial: true }), { rail: true, position: 'left' });
  }
});
for (const isRTL of [false, true]) {
  test(`Expo Router row ordering preserves physical edges (RTL=${isRTL})`, () => {
    for (const [patch, expected] of [
      [{}, 'bottom'],
      [{ isHorizon: true }, 'left'],
      [{ isSpatial: true }, 'left'],
      [{ isTablet: true }, 'right'],
      [{ isFoldable: true }, 'right'],
      [{ hardwareColumnWidth: 90 }, 'right'],
    ] as const) {
      const { position } = navigationPresentation({ ...phone, ...patch });
      const tabPosition = tabBarPositionForDirection(position, isRTL);
      const renderedEdge = tabPosition === 'bottom' ? 'bottom'
        : (tabPosition === 'left') !== isRTL ? 'left' : 'right';
      assert.equal(renderedEdge, expected);
    }
  });
  test(`rail padding uses its physical edge once and border faces content (RTL=${isRTL})`, () => {
    for (const position of ['left', 'right'] as const) {
      const style = navigationRailStyle({
        position, isRTL, insets: { left: 13, right: 29 }, hardwareColumnWidth: 0, railWidth: 88,
      });
      const leftPadding = isRTL ? style.paddingEnd : style.paddingStart;
      const rightPadding = isRTL ? style.paddingStart : style.paddingEnd;
      const leftBorder = isRTL ? style.borderEndWidth : style.borderStartWidth;
      const rightBorder = isRTL ? style.borderStartWidth : style.borderEndWidth;
      assert.equal(style.width, 88 + (position === 'left' ? 13 : 29));
      assert.equal(leftPadding, position === 'left' ? 13 : 0);
      assert.equal(rightPadding, position === 'right' ? 29 : 0);
      assert.equal(leftBorder, position === 'right' ? 1 : 0);
      assert.equal(rightBorder, position === 'left' ? 1 : 0);
    }
  });
  test(`reserved physical-right hardware column is not consumed twice (RTL=${isRTL})`, () => {
    const style = navigationRailStyle({
      position: 'right', isRTL, insets: { left: 13, right: 90 }, hardwareColumnWidth: 90, railWidth: 88,
    });
    assert.equal(style.width, 90);
    assert.equal(style.paddingStart, 0);
    assert.equal(style.paddingEnd, 0);
  });
  test(`a spatial left rail does not consume a physical-right hardware column (RTL=${isRTL})`, () => {
    const style = navigationRailStyle({
      position: 'left', isRTL, insets: { left: 13, right: 90 }, hardwareColumnWidth: 90, railWidth: 88,
    });
    assert.equal(style.width, 101);
    assert.equal(style.paddingStart + style.paddingEnd, 13);
  });
}
