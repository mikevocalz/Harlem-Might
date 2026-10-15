import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeEntities, stripHtml } from './seed-text.ts';

describe('seed text decoding', () => {
  for (const decode of [decodeEntities, stripHtml]) {
    describe(decode.name, () => {
      it('decodes supported named and decimal entities without changing ordinary text', () => {
        const expected = decode === stripHtml ? 'Harlem & Sylvia’s "Jazz"' : 'Harlem & Sylvia’s   "Jazz"';
        assert.equal(decode('  Harlem &amp; Sylvia&#8217;s &nbsp; &quot;Jazz&quot;  '), expected);
        assert.equal(decode('&apos;&lt;&gt;'), "'<>");
        assert.equal(decode('A&#128512;B'), 'A😀B');
        assert.equal(decode('A&#1114111;B'), 'A\u{10ffff}B');
        assert.equal(decode('Música, 爵士 and 🥁'), 'Música, 爵士 and 🥁');
      });

      for (const entity of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'unknown']) {
        it(`preserves unsupported named entity ${entity}`, () => {
          assert.equal(decode(`Harlem &${entity}; Jazz`), `Harlem &${entity}; Jazz`);
        });
      }

      for (const entity of ['1114112', '9007199254740992', '9'.repeat(400)]) {
        it(`preserves an out-of-range decimal entity (${entity.length} digits)`, () => {
          assert.equal(decode(`A&#${entity};B`), `A&#${entity};B`);
        });
      }

      it('keeps malformed and unsupported references as text', () => {
        assert.equal(decode('&#-1; &#1.5; &#x41; &amp &#;'), '&#-1; &#1.5; &#x41; &amp &#;');
      });

      it('does not abort later feed rows after a malformed title', () => {
        assert.deepEqual(['A&#1114112;B', 'Apollo &amp; Jazz'].map(decode), ['A&#1114112;B', 'Apollo & Jazz']);
      });

      it('retains the supported one-pass entity decoding order', () => {
        assert.equal(decode('&#38;amp; &amp;lt;'), '& &lt;');
      });
    });
  }

  it('keeps event whitespace while media descriptions strip tags and collapse whitespace', () => {
    const value = '  <b>Harlem</b>\n &amp;   Jazz  ';
    assert.equal(decodeEntities(value), '<b>Harlem</b>\n &   Jazz');
    assert.equal(stripHtml(value), 'Harlem & Jazz');
  });

  it('returns empty text for empty or all-whitespace feed fields', () => {
    assert.equal(decodeEntities(''), '');
    assert.equal(stripHtml('  \n '), '');
  });
});
