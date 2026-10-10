import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dekFrom, firstSentence } from './first-sentence.ts';

test('does not stop at abbreviations or initials', () => {
  assert.equal(firstSentence('The St. Nicholas Historic District is a district. It has rows.'), 'The St. Nicholas Historic District is a district.');
  assert.equal(firstSentence('125th Street, co-named Martin Luther King Jr. Boulevard, is a street. More.'), '125th Street, co-named Martin Luther King Jr. Boulevard, is a street.');
  assert.equal(firstSentence('W. E. B. Du Bois wrote it. Then more.'), 'W. E. B. Du Bois wrote it.');
  assert.equal(firstSentence('Harlem is a neighborhood. It is big.'), 'Harlem is a neighborhood.');
});

test('dekFrom cuts long sentences at a word boundary', () => {
  const dek = dekFrom(`${'word '.repeat(60)}end.`, 40);
  assert.ok(dek.endsWith('word…'));
  assert.ok(dek.length <= 40);
});
