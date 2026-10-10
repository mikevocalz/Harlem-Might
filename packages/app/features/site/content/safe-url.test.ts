import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { safeHttpUrl } from './safe-url.ts';

describe('safeHttpUrl', () => {
  it('keeps http and https URLs', () => {
    assert.equal(safeHttpUrl('https://www.apollotheater.org/events'), 'https://www.apollotheater.org/events');
    assert.equal(safeHttpUrl('http://example.org'), 'http://example.org/');
  });

  it('drops script and data URLs, whatever the case or padding', () => {
    assert.equal(safeHttpUrl('javascript:alert(1)'), undefined);
    assert.equal(safeHttpUrl('  JavaScript:alert(1)'), undefined);
    assert.equal(safeHttpUrl('data:text/html,<script>alert(1)</script>'), undefined);
  });

  it('drops relative paths, garbage and empty values', () => {
    assert.equal(safeHttpUrl('/places/apollo-theater'), undefined);
    assert.equal(safeHttpUrl('//evil.example/x'), undefined);
    assert.equal(safeHttpUrl('not a url'), undefined);
    assert.equal(safeHttpUrl(''), undefined);
    assert.equal(safeHttpUrl(null), undefined);
    assert.equal(safeHttpUrl(undefined), undefined);
  });
});
