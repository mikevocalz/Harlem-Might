import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { provisionKey } from './create-payload-mcp-key.mjs';

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'payload-key-helper-test-'));
  const configPath = join(directory, 'mcp_config.local.json');
  const config = { mcpServers: { unrelated: { url: 'https://example.invalid/mcp' }, 'payload-mcp': { transport: 'stdio', command: 'node', env: { PAYLOAD_PUSH: 'false', PAYLOAD_MCP_OVERRIDE_ACCESS: 'false', ...options.env } } } };
  await writeFile(configPath, JSON.stringify(config));
  const original = await readFile(configPath, 'utf8');
  const calls = [];
  let createdKey;
  let recoveryPath;
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
    if (recoveryPath) await rm(dirname(recoveryPath), { recursive: true, force: true });
  });
  const response = (body, status = 200) => Response.json(body, { status });
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(new URL(url).origin, 'http://localhost:3000');
    if (url.endsWith('/users/login')) {
      assert.deepEqual(JSON.parse(init.body), { email: 'curator@example.invalid', password: 'test-password-not-real' });
      return options.loginFailure ? response({}, 401) : response({ token: 'test-jwt-not-real' });
    }
    if (url.endsWith('/users/me')) {
      const usingKey = init.headers.Authorization.startsWith('users API-Key ');
      if (usingKey) assert.equal(init.headers.Authorization, `users API-Key ${createdKey}`);
      else assert.equal(init.headers.Authorization, 'JWT test-jwt-not-real');
      return response({ user: { id: usingKey && options.wrongVerification ? 18 : options.userId ?? 17, collection: options.collection ?? 'users' } });
    }
    if (init.method === 'GET') {
      assert.ok(url.includes('/users/17?'));
      return response(options.missingKeyState ? {} : { apiKeyLast4: options.existingKey ? 'test' : null });
    }
    assert.equal(url, 'http://localhost:3000/payload-api/users/17');
    assert.equal(init.method, 'PATCH');
    assert.equal(init.headers.Authorization, 'JWT test-jwt-not-real');
    const data = JSON.parse(init.body);
    assert.deepEqual(Object.keys(data), ['apiKey']);
    assert.match(data.apiKey, /^[a-f0-9]{64}$/);
    createdKey = data.apiKey;
    assert.ok(recoveryPath);
    assert.equal((await stat(recoveryPath)).mode & 0o777, 0o600);
    if (options.patchFailure) throw new Error('simulated network failure');
    if (options.concurrentChange) await writeFile(configPath, JSON.stringify({ changedByUser: true }));
    return response({ doc: { id: 17 } });
  };
  return {
    configPath, original, calls,
    run: () => provisionKey({ email: 'curator@example.invalid', password: 'test-password-not-real', configPath, fetchImpl, onRecoveryFile: value => { recoveryPath = value; } }),
    recoveryPath: () => recoveryPath,
  };
}

test('creates only a new key for the authenticated curator and stores it privately', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.run(), { created: true, verified: true, configPath: f.configPath });
  const text = await readFile(f.configPath, 'utf8');
  const config = JSON.parse(text);
  assert.match(config.mcpServers['payload-mcp'].env.PAYLOAD_MCP_AUTHORIZATION, /^users API-Key [a-f0-9]{64}$/);
  assert.equal(config.mcpServers['payload-mcp'].env.PAYLOAD_MCP_OVERRIDE_ACCESS, 'false');
  assert.deepEqual(config.mcpServers.unrelated, { url: 'https://example.invalid/mcp' });
  assert.equal((await stat(f.configPath)).mode & 0o777, 0o600);
  assert.ok(!text.includes('test-password-not-real'));
  assert.ok(!text.includes('test-jwt-not-real'));
  assert.equal(f.calls.filter(call => call.init.method === 'PATCH').length, 1);
});

for (const [name, options] of [
  ['failed login', { loginFailure: true }],
  ['consumer instead of curator', { collection: 'members' }],
  ['empty curator ID', { userId: '' }],
  ['invalid curator ID', { userId: -1 }],
  ['existing API key', { existingKey: true }],
  ['unreadable key state', { missingKeyState: true }],
  ['already configured authorization', { env: { PAYLOAD_MCP_AUTHORIZATION: 'existing-test-authorization' } }],
  ['access bypass enabled', { env: { PAYLOAD_MCP_OVERRIDE_ACCESS: 'true' } }],
  ['schema push enabled', { env: { PAYLOAD_PUSH: 'true' } }],
]) {
  test(`refuses ${name} without changing the account or MCP configuration`, async t => {
    const f = await fixture(t, options);
    await assert.rejects(f.run());
    assert.equal(await readFile(f.configPath, 'utf8'), f.original);
    assert.equal(f.calls.some(call => call.init.method === 'PATCH'), false);
    assert.equal(f.recoveryPath(), undefined);
  });
}

for (const [name, options] of [
  ['ambiguous API failure', { patchFailure: true }],
  ['different verified identity', { wrongVerification: true }],
  ['concurrent config edit', { concurrentChange: true }],
]) {
  test(`preserves a private recovery file after ${name} without overwriting config`, async t => {
    const f = await fixture(t, options);
    await assert.rejects(f.run(), /protected recovery configuration/);
    assert.equal((await stat(f.recoveryPath())).mode & 0o777, 0o600);
    const current = await readFile(f.configPath, 'utf8');
    if (options.concurrentChange) assert.deepEqual(JSON.parse(current), { changedByUser: true });
    else assert.equal(current, f.original);
    assert.equal(f.calls.filter(call => call.init.method === 'PATCH').length, 1);
  });
}
