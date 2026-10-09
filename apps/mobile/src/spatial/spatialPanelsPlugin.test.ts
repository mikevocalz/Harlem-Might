import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const plugin = createRequire(import.meta.url)('../../modules/spatial-panels/app.plugin.js');

const questManifest = () => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [{ activity: [{ $: { 'android:name': '.MainActivity' } }] }],
  },
});

describe('spatial-panels config plugin (ADR 0006)', () => {
  it('declares the panel activity with a 400x600dp layout', () => {
    const manifest = plugin.addPanelActivity(questManifest(), { defaultWidth: '400dp', defaultHeight: '600dp' });
    const activities = manifest.manifest.application[0].activity;
    assert.equal(activities.length, 2);
    const panel = activities[1];
    assert.equal(panel.$['android:name'], plugin.PANEL_ACTIVITY);
    assert.equal(panel.$['android:exported'], 'false');
    assert.deepEqual(panel.layout, [{ $: { 'android:defaultWidth': '400dp', 'android:defaultHeight': '600dp' } }]);
  });

  it('replaces its own entry instead of adding a second one', () => {
    const once = plugin.addPanelActivity(questManifest(), { defaultWidth: '400dp', defaultHeight: '600dp' });
    const twice = plugin.addPanelActivity(once, { defaultWidth: '480dp', defaultHeight: '600dp' });
    const panels = twice.manifest.application[0].activity.filter(
      (activity: { $: Record<string, string> }) => activity.$['android:name'] === plugin.PANEL_ACTIVITY,
    );
    assert.equal(panels.length, 1);
    assert.equal(panels[0].layout[0].$['android:defaultWidth'], '480dp');
  });

  it('rejects sizes outside Meta’s panel range or without dp', () => {
    assert.throws(() => plugin.panelActivityElement({ defaultWidth: '300dp', defaultHeight: '600dp' }), /384/);
    assert.throws(() => plugin.panelActivityElement({ defaultWidth: '400', defaultHeight: '600dp' }), /400dp/);
  });
});
