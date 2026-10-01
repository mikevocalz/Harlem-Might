import nextEnv from '@next/env';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(appDir, '../..');
const command = process.argv[2];
const { loadEnvConfig } = nextEnv;
const require = createRequire(import.meta.url);

if (!command) {
  throw new Error('Expected a Next.js command (dev, build, or start).');
}

loadEnvConfig(workspaceRoot, command === 'dev', console);

const child = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), command, ...process.argv.slice(3)],
  {
    cwd: appDir,
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
