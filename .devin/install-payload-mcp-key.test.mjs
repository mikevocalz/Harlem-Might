import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installKey } from './install-payload-mcp-key.mjs';

const key = 'test-key-value-not-real';

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'payload-key-install-test-'));
  const configPath = join(directory, 'mcp_config.local.json');
  const config = { mcpServers: { unrelated: { url: 'https://example.invalid/mcp' }, 'payload-mcp': { transport: 'stdio', command: 'node', env: { PAYLOAD_PUSH: 'false', PAYLOAD_MCP_OVERRIDE_ACCESS: 'false', ...options.env } } } };
  await writeFile(configPath, JSON.stringify(config));
  const original = await readFile(configPath, 'utf8');
  const calls = [];
  t.after(async () => { await rm(directory, { recursive: true, force: true }); });
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(url, 'http://localhost:3000/payload-api/users/me');
    assert.equal(init.headers.Authorization, `users API-Key ${key}`);
    if (options.rejectedKey) return Response.json({}, { status: 401 });
    if (options.concurrentChange) await writeFile(configPath, JSON.stringify({ changedByUser: true }));
    return Response.json({ user: { id: options.userId ?? 17, collection: options.collection ?? 'users' } });
  };
  return {
    configPath, original, calls,
    run: () => installKey({ key, configPath, fetchImpl }),
  };
}

test('verifies the key as a curator and stores it privately without printing', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.run(), { installed: true, curatorId: 17, configPath: f.configPath });
  const text = await readFile(f.configPath, 'utf8');
  const config = JSON.parse(text);
  assert.equal(config.mcpServers['payload-mcp'].env.PAYLOAD_MCP_AUTHORIZATION, `users API-Key ${key}`);
  assert.equal(config.mcpServers['payload-mcp'].env.PAYLOAD_MCP_OVERRIDE_ACCESS, 'false');
  assert.equal(config.mcpServers['payload-mcp'].env.PAYLOAD_PUSH, 'false');
  assert.deepEqual(config.mcpServers.unrelated, { url: 'https://example.invalid/mcp' });
  assert.equal((await stat(f.configPath)).mode & 0o777, 0o600);
  assert.equal(f.calls.length, 1);
});

for (const [name, options] of [
  ['rejected key', { rejectedKey: true }],
  ['member instead of curator', { collection: 'members' }],
  ['invalid curator ID', { userId: '17' }],
  ['already configured authorization', { env: { PAYLOAD_MCP_AUTHORIZATION: 'existing-test-authorization' } }],
  ['access bypass enabled', { env: { PAYLOAD_MCP_OVERRIDE_ACCESS: 'true' } }],
  ['schema push enabled', { env: { PAYLOAD_PUSH: 'true' } }],
  ['concurrent config edit', { concurrentChange: true }],
]) {
  test(`refuses ${name} without changing the MCP configuration`, async t => {
    const f = await fixture(t, options);
    await assert.rejects(f.run());
    if (options.concurrentChange) assert.deepEqual(JSON.parse(await readFile(f.configPath, 'utf8')), { changedByUser: true });
    else assert.equal(await readFile(f.configPath, 'utf8'), f.original);
  });
}

test('refuses an empty key before any request or write', async t => {
  const f = await fixture(t);
  await assert.rejects(installKey({ key: '  ', configPath: f.configPath, fetchImpl: () => assert.fail('must not fetch') }));
  assert.equal(await readFile(f.configPath, 'utf8'), f.original);
});
