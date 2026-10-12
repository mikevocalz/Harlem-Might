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
const authorizationPrefix = 'users API-Key ';

export class KeyInstallError extends Error {}

/**
 * Installs an API key created through the Payload admin into the ignored local
 * MCP config. Verifies the key authenticates as a `users` curator before
 * writing. Never creates, rotates, or prints a key.
 */
export async function installKey({ key, configPath = defaultConfigPath, fetchImpl = fetch }) {
  if (typeof key !== 'string' || !key.trim()) throw new KeyInstallError('An API key value is required.');
  const trimmed = key.trim();
  const original = await readFile(configPath, 'utf8');
  const config = JSON.parse(original);
  const server = config.mcpServers?.['payload-mcp'];
  if (server?.transport !== 'stdio' || server.env?.PAYLOAD_MCP_OVERRIDE_ACCESS !== 'false' || server.env?.PAYLOAD_PUSH !== 'false') {
    throw new KeyInstallError('Expected the existing protected payload-mcp stdio configuration.');
  }
  if (server.env.PAYLOAD_MCP_AUTHORIZATION) throw new KeyInstallError('MCP authorization is already configured; it will not be replaced.');
  if ((await stat(dirname(configPath))).dev !== (await stat(tmpdir())).dev) {
    throw new KeyInstallError('TMPDIR must be on the same filesystem as the local MCP configuration for atomic secret storage.');
  }

  const authorization = `${authorizationPrefix}${trimmed}`;
  const response = await fetchImpl(`${apiBase}/users/me`, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { accept: 'application/json', Authorization: authorization },
  });
  if (!response.ok) throw new KeyInstallError(`The API key was rejected (HTTP ${response.status}). Nothing was written.`);
  const session = await response.json();
  if (session.user?.collection !== 'users' || !Number.isSafeInteger(session.user.id)) {
    throw new KeyInstallError('The API key did not authenticate as a Payload users curator. Nothing was written.');
  }

  server.env.PAYLOAD_MCP_AUTHORIZATION = authorization;
  const staging = await mkdtemp(join(tmpdir(), 'harlem-payload-mcp-install-'));
  await chmod(staging, 0o700);
  const stagedPath = join(staging, 'mcp_config.local.json');
  try {
    await writeFile(stagedPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    if (await readFile(configPath, 'utf8') !== original) throw new KeyInstallError('MCP configuration changed during install; nothing was written.');
    await rename(stagedPath, configPath);
    await chmod(configPath, 0o600);
    return { installed: true, curatorId: session.user.id, configPath };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new KeyInstallError('Run this helper interactively in your own terminal; do not paste the key into chat.');
  if (spawnSync('git', ['check-ignore', '--quiet', defaultConfigPath], { cwd: projectRoot }).status !== 0) {
    throw new KeyInstallError('The local MCP configuration must be Git-ignored before a secret can be stored there.');
  }
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk, encoding); callback(); } });
  const input = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  input.on('SIGINT', () => abort.abort());
  let key;
  try {
    process.stdout.write('Payload curator API key (hidden): ');
    hidden = true;
    key = await input.question('', { signal: abort.signal });
  } finally {
    hidden = false;
    input.close();
    process.stdout.write('\n');
  }
  const result = await installKey({ key });
  console.log(`API key verified for curator #${result.curatorId} and stored only in ${result.configPath} with owner-only permissions.`);
  console.log('Reload the project MCP connections to use payload-mcp. The key was not printed.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof KeyInstallError ? error.message : 'Key install failed or was cancelled. No credential details were logged.');
    process.exitCode = 1;
  });
}
