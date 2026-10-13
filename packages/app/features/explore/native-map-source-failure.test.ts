import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

function check(scenario: string, source: string, boundary = 'none', outcome = 'reject') {
  const result = spawnSync(process.execPath, [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    fileURLToPath(new URL('./test-helpers/native-map-attachment.mjs', import.meta.url)),
    scenario, boundary, outcome, source,
  ], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

for (const source of ['catalogue', 'selection', 'route-walked', 'route-ahead', 'route-alternatives', 'fix-walked', 'fix-ahead']) {
  for (const outcome of ['reject', 'throw']) {
    it(`current native ${source} ${outcome} activates schematic fallback and stops writes`, () => check('source-current', source, 'none', outcome));
  }
  for (const boundary of ['replace', 'null-ref', 'effect-replay', 'unmount', 'style-reload', 'style-reuse']) {
    it(`native ${source} rejection after ${boundary} cannot fail the current map`, () => check('source-stale', source, boundary));
  }
  it(`a newer native ${source} update supersedes an older failure`, () => check('source-superseded', source));
}

for (const stage of ['config', 'source', 'layer']) {
  for (const outcome of ['resolve', 'reject']) {
    it(`reused native style objects supersede pending ${stage} ${outcome}`, () => check('setup-reuse', stage, 'none', outcome));
  }
  it(`native style setup reconciles catalogue and selection changed during ${stage}`, () => check('setup-latest', stage));
}
for (const method of ['addGeoJsonSource', 'addLayer']) {
  for (const outcome of ['throw', 'reject']) {
    it(`current native ${method} ${outcome} still activates fallback`, () => check('setup-current', method, 'none', outcome));
  }
}
for (const method of ['setStandardConfig', 'fitBounds', 'getCameraState', 'flyTo', 'queryRenderedFeatures']) {
  for (const outcome of ['throw', 'reject']) {
    it(`optional native ${method} ${outcome} does not fail the map`, () => check('optional-error', method, 'none', outcome));
  }
}
it('a different source update cannot suppress a current native route failure', () => check('source-independent', 'route-ahead'));
