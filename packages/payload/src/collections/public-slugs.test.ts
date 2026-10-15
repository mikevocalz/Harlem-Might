import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CollectionConfig, TextField } from 'payload';
import { Places } from './Places.ts';
import { MusicArtists } from './MusicArtists.ts';

function slugField(collection: CollectionConfig): TextField {
  const field = collection.fields.find((candidate) => 'name' in candidate && candidate.name === 'slug');
  assert.ok(field && field.type === 'text', `${collection.slug} has a text slug field`);
  assert.equal(field.required, true);
  assert.equal(field.unique, true);
  assert.equal(field.index, true);
  return field;
}

for (const collection of [Places, MusicArtists]) {
  test(`${collection.slug} accepts only slugs its public detail reader can resolve`, async () => {
    const field = slugField(collection);
    assert.equal(typeof field.validate, 'function', 'the public slug is validated before it is saved');
    const validate = field.validate as (value: string | null | undefined, options: unknown) => unknown;
    for (const value of ['apollo-theater', '125th-street', 'b4', 'harlem']) {
      assert.equal(await validate(value, {}), true, value);
    }
    for (const value of ['Apollo', 'apollo theater', 'apollo--theater', '../apollo', 'apollo/harlem', '-apollo', 'apollo-', 'café', '', null, undefined]) {
      assert.notEqual(await validate(value, {}), true, String(value));
    }
  });
}
