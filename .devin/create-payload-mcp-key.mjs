import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultConfigPath = join(projectRoot, '.devin/mcp_config.local.json');
const apiBase = 'http://localhost:3000/payload-api';

export class KeySetupError extends Error {}

export async function provisionKey({ email, password, configPath = defaultConfigPath, fetchImpl = fetch, onRecoveryFile = () => {} }) {
  if (!email?.trim() || !password) throw new KeySetupError('Curator email and password are required.');
  const original = await readFile(configPath, 'utf8');
  const config = JSON.parse(original);
  const server = config.mcpServers?.['payload-mcp'];
  if (server?.transport !== 'stdio' || server.env?.PAYLOAD_MCP_OVERRIDE_ACCESS !== 'false' || server.env?.PAYLOAD_PUSH !== 'false') {
    throw new KeySetupError('Expected the existing protected payload-mcp stdio configuration.');
  }
  if (server.env.PAYLOAD_MCP_AUTHORIZATION) throw new KeySetupError('MCP authorization is already configured; it will not be replaced.');
  if ((await stat(dirname(configPath))).dev !== (await stat(tmpdir())).dev) {
    throw new KeySetupError('TMPDIR must be on the same filesystem as the local MCP configuration for atomic secret storage.');
  }

  const request = async (path, { method = 'GET', authorization, data } = {}) => {
    const response = await fetchImpl(`${apiBase}${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept: 'application/json',
        ...(data ? { 'content-type': 'application/json' } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    if (!response.ok) throw new KeySetupError(`Payload ${method} request failed (HTTP ${response.status}). No access checks were bypassed.`);
    return response.json();
  };

  const login = await request('/users/login', { method: 'POST', data: { email: email.trim(), password } });
  if (typeof login.token !== 'string' || !login.token) throw new KeySetupError('Payload did not return a curator login token.');
  const authorization = `JWT ${login.token}`;
  const session = await request('/users/me', { authorization });
  const user = session.user;
  if (user?.collection !== 'users' || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new KeySetupError('An existing Payload users curator account is required.');
  }
  const userPath = `/users/${encodeURIComponent(user.id)}`;
  const current = await request(`${userPath}?depth=0&select[apiKeyLast4]=true`, { authorization });
  if (!Object.hasOwn(current, 'apiKeyLast4')) throw new KeySetupError('Could not verify API-key state with this account.');
  if (current.apiKeyLast4 != null && current.apiKeyLast4 !== '') throw new KeySetupError('This curator already has an API key. It will not be rotated or replaced.');

  const key = randomBytes(32).toString('hex');
  server.env.PAYLOAD_MCP_AUTHORIZATION = `users API-Key ${key}`;
  const recoveryDirectory = await mkdtemp(join(tmpdir(), 'harlem-payload-mcp-key-'));
  await chmod(recoveryDirectory, 0o700);
  const recoveryPath = join(recoveryDirectory, 'mcp_config.local.json');
  let attemptedCreation = false;
  let installed = false;
  try {
    await writeFile(recoveryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    if (await readFile(configPath, 'utf8') !== original) throw new KeySetupError('MCP configuration changed during sign-in; no key was created.');
    onRecoveryFile(recoveryPath);
    attemptedCreation = true;
    await request(userPath, { method: 'PATCH', authorization, data: { apiKey: key } });
    const verified = await request('/users/me', { authorization: server.env.PAYLOAD_MCP_AUTHORIZATION });
    if (verified.user?.collection !== 'users' || verified.user.id !== user.id) throw new KeySetupError('The new API key did not authenticate as the same curator.');
    if (await readFile(configPath, 'utf8') !== original) throw new KeySetupError('MCP configuration changed during creation; the protected recovery file was retained.');
    await rename(recoveryPath, configPath);
    installed = true;
    return { created: true, verified: true, configPath };
  } catch (error) {
    if (attemptedCreation) {
      throw new KeySetupError(`Key creation or installation did not finish. A key may have been created. The protected recovery configuration is retained at ${recoveryPath}. Do not generate another key until this is checked.`);
    }
    throw error;
  } finally {
    if (!attemptedCreation || installed) await rm(recoveryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new KeySetupError('Run this helper interactively in your own terminal; do not paste credentials into chat.');
  if (spawnSync('git', ['check-ignore', '--quiet', defaultConfigPath], { cwd: projectRoot }).status !== 0) {
    throw new KeySetupError('The local MCP configuration must be Git-ignored before a secret can be stored there.');
  }
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk, encoding); callback(); } });
  const input = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  input.on('SIGINT', () => abort.abort());
  let email;
  let password;
  try {
    email = await input.question('Existing Payload curator email: ', { signal: abort.signal });
    process.stdout.write('Curator password (hidden): ');
    hidden = true;
    password = await input.question('', { signal: abort.signal });
  } finally {
    hidden = false;
    input.close();
    process.stdout.write('\n');
  }
  const result = await provisionKey({ email, password, onRecoveryFile: path => console.log(`Protected recovery file prepared: ${path}`) });
  console.log(`API key created and verified. Stored only in ${result.configPath} with owner-only permissions.`);
  console.log('Reload the project MCP connections to use payload-mcp. The key and password were not printed.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof KeySetupError ? error.message : 'Key setup failed or was cancelled. No credential details were logged.');
    process.exitCode = 1;
  });
}
