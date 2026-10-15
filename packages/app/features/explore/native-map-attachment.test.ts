import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';

function check(scenario: string, boundary: string, outcome = 'resolve', stage = 'layer') {
  const result = spawnSync(process.execPath, [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    fileURLToPath(new URL('./test-helpers/native-map-attachment.mjs', import.meta.url)),
    scenario, boundary, outcome, stage,
  ], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

for (const boundary of ['replace', 'null-ref', 'effect-replay', 'unmount']) {
  for (const outcome of ['resolve', 'reject']) {
    it(`native style ${outcome} after ${boundary} cannot publish stale style or status`, () => check('style', boundary, outcome));
  }
  it(`native feature queries and queued listeners stop at ${boundary}`, () => check('query', boundary));
  it(`native selection camera completion stops at ${boundary}`, () => check('camera', boundary));
}
for (const stage of ['config', 'source']) {
  for (const outcome of ['resolve', 'reject']) {
    it(`native ${stage} ${outcome} after replacement stops further setup`, () => check('style', 'replace', outcome, stage));
  }
}
it('a newer style on the same native view supersedes pending setup', () => check('style', 'style-reload'));
it('a current native style failure still enters the schematic fallback', () => check('current-error', 'none'));
it('a superseded selection cannot finish an older camera request', () => check('camera', 'selection'));
