import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import type { Field, FieldHook, IncomingAuthType } from 'payload';
import { Users } from './Users.ts';

const { getBaseAuthFields } = await import(new URL('./auth/getAuthFields.js', import.meta.resolve('payload')).href) as {
  getBaseAuthFields: (auth: IncomingAuthType, fields?: Field[]) => Field[];
};
const auth = typeof Users.auth === 'object' ? Users.auth : {};
const fields = getBaseAuthFields(auth, Users.fields);

it('enables user API keys without enabling reveal or changing existing collection settings', () => {
  assert.deepEqual(Users.auth, { useAPIKey: true });
  assert.equal(typeof auth.useAPIKey === 'object' && auth.useAPIKey.reveal === true, false);
  assert.equal(Users.slug, 'users');
  assert.deepEqual(Users.admin, { useAsTitle: 'email' });
  assert.deepEqual(Users.fields, [{ name: 'name', type: 'text' }]);
  assert.equal(Users.access, undefined);
});

it('keeps local email and password authentication enabled', () => {
  assert.ok(Users.auth);
  assert.equal(auth.disableLocalStrategy, undefined);
  for (const name of ['email', 'hash', 'salt', 'resetPasswordToken', 'resetPasswordExpiration']) {
    assert.ok(fields.some((field) => 'name' in field && field.name === name), name);
  }
});

it('uses the installed v4 API key fields and keeps secrets unreadable', async () => {
  for (const name of ['apiKey', 'apiKeyLast4', 'apiKeyIndex']) {
    const field = fields.find((field) => 'name' in field && field.name === name);
    assert.ok(field && field.type === 'text', name);
    assert.equal(field.required, undefined);
    if (name === 'apiKeyLast4') continue;
    const read = field.access?.read;
    assert.ok(read);
    assert.equal(await read({} as Parameters<typeof read>[0]), false);
    const siblingData: Record<string, unknown> = { [name]: undefined };
    assert.ok(field.hooks?.afterRead?.length);
    for (const hook of field.hooks.afterRead) {
      await hook({ siblingData } as Parameters<FieldHook>[0]);
    }
    assert.equal(Object.hasOwn(siblingData, name), false);
  }
  assert.equal(fields.some((field) => 'name' in field && field.name === 'enableAPIKey'), false);
});

it('prepares only the six nullable key columns required by users and its version table', () => {
  const migration = readFileSync(new URL('../migrations/20261012_152659_users_api_keys.ts', import.meta.url), 'utf8');
  const snapshot = JSON.parse(readFileSync(new URL('../migrations/20261012_152659_users_api_keys.json', import.meta.url), 'utf8'));
  const up = migration.split('export async function down')[0];
  assert.ok(up);
  assert.doesNotMatch(up, /\b(?:CREATE|DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/);
  assert.equal(up.match(/ALTER TABLE/g)?.length, 2);
  assert.equal(up.match(/ADD COLUMN/g)?.length, 6);
  for (const [table, prefix] of [['users', ''], ['_users_v', 'version_']]) {
    assert.ok(up.includes(`ALTER TABLE "payload"."${table}"`));
    for (const field of ['api_key', 'api_key_last4', 'api_key_index']) {
      const column = `${prefix}${field}`;
      assert.ok(up.includes(`ADD COLUMN "${column}" varchar`));
      assert.equal(snapshot.tables[`payload.${table}`].columns[column].type, 'varchar');
      assert.equal(snapshot.tables[`payload.${table}`].columns[column].notNull, false);
    }
  }
});
