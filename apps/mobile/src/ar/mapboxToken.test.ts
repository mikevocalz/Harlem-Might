import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMapboxToken } from './mapboxToken.ts';

describe('parseMapboxToken', () => {
  it('accepts a public pk. token and trims it', () => {
    assert.deepEqual(parseMapboxToken('  pk.abc  '), { kind: 'public', token: 'pk.abc' });
  });

  it('reports a missing token', () => {
    assert.deepEqual(parseMapboxToken(undefined), { kind: 'missing' });
    assert.deepEqual(parseMapboxToken('   '), { kind: 'missing' });
  });

  it('refuses secret and other tokens in the app bundle', () => {
    assert.deepEqual(parseMapboxToken('sk.secret'), { kind: 'not-public' });
    assert.deepEqual(parseMapboxToken('abc'), { kind: 'not-public' });
  });
});
