import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixture, defaultSource, mutations } from './build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const caseNames = [
  'real browser, responsive media and React ref ownership',
  'Back restores the newly committed heading, repeatedly and while modal',
  'Back requests superseded by a different or removed URL selection cannot replay',
  'guidance supersedes Back; ending it cannot replay an old focus request',
  'full phone modal releases and reacquires inert when guidance hides/reveals it',
  'native History Back/Forward, Escape guards and focus return',
  'actual useSyncExternalStore owns updates, selectors, StrictMode cleanup and shared clock',
  'real RNW timing animation cancels its browser frame on stop',
];
export function chromeArgs({ profile, viewport, url }) {
  if (!['phone', 'desktop'].includes(viewport)) throw new Error(`Unknown viewport: ${viewport}`);
  // Use the installed browser's normal sandbox. No --no-sandbox, remote debug
  // port, CORS override, certificate bypass, or weakened site isolation.
  return ['--headless', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--dump-dom', '--virtual-time-budget=15000', `--window-size=${viewport === 'phone' ? '500,900' : '1280,900'}`, url];
}
export function parseReport(html, viewport) {
  const match = html.match(/<pre\b(?=[^>]*\bid="browser-results")(?=[^>]*\bdata-status="(passed|failed)")[^>]*>([A-Za-z0-9+/=]+)<\/pre>/);
  if (!match) throw new Error('Browser did not report completed contracts (crash, script error or timeout); a blank/running page is not a pass');
  const report = JSON.parse(Buffer.from(match[2], 'base64').toString('utf8'));
  if (report.viewport !== viewport || report.reactVersion !== '19.3.0' || !/(?:Chrome|Chromium)\//.test(report.userAgent)) throw new Error('Report lacks the expected viewport, pinned React or Chrome runtime');
  if (!Array.isArray(report.results) || caseNames.some((name) => report.results.filter((result) => result.name === name).length !== 1)) throw new Error('Browser report omitted or duplicated required contract cases');
  if (report.results.some((result) => typeof result.passed !== 'boolean')) throw new Error('Browser report contains an invalid result');
  const passed = report.results.every((result) => result.passed);
  if ((match[1] === 'passed') !== passed) throw new Error('Browser report status contradicts its assertions');
  return { ...report, passed };
}
export function requireMutationFailure(report, mutation) {
  const expected = { 'focus-before-commit': caseNames[1], 'ignore-guidance': caseNames[3], 'old-modal-policy': caseNames[4] }[mutation];
  if (!expected) throw new Error(`Unknown mutation: ${mutation}`);
  if (!report.results.some((result) => result.name === expected && !result.passed)) throw new Error(`Mutation ${mutation} did not fail its targeted browser assertion`);
}
function chromeBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const check = spawnSync(name, ['--version'], { encoding: 'utf8' });
    if (check.status === 0) return name;
  }
  throw new Error('Chrome/Chromium is required. Set CHROME_BIN to an installed official browser. This runner does not download a browser or weaken its sandbox.');
}
async function executeChrome(binary, args) {
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 45_000);
    child.stdout.on('data', (data) => { stdout += data; if (stdout.length > 16 * 1024 * 1024) child.kill('SIGKILL'); });
    child.stderr.on('data', (data) => { stderr = (stderr + data).slice(-512 * 1024); });
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      if (timedOut) reject(new Error(`Chrome timed out after 45 seconds. ${stderr}`));
      else if (code !== 0) reject(new Error(`Chrome exited ${code ?? signal}. ${stderr}`));
      else resolve({ stdout, stderr });
    });
  });
}
export async function run({ source = defaultSource, output = path.join(here, 'dist'), checkMutations = true } = {}) {
  mkdirSync(output, { recursive: true });
  const browser = chromeBinary();
  const version = spawnSync(browser, ['--version'], { encoding: 'utf8' }).stdout.trim();
  console.log(`Using ${version}; sandbox enabled`);
  const built = new Map();
  for (const mutation of [undefined, ...(checkMutations ? mutations : [])]) {
    built.set(mutation ?? 'baseline', await buildFixture({ source, output: path.join(output, mutation ?? 'baseline'), mutation }));
  }
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/explore') { response.writeHead(404).end(); return; }
    const html = built.get(url.searchParams.get('mutation') ?? 'baseline');
    if (!html) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'" }).end(html);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  const reports = [];
  try {
    for (const mutation of [undefined, ...(checkMutations ? mutations : [])]) {
      for (const viewport of mutation ? ['phone'] : ['phone', 'desktop']) {
        const label = `${mutation ?? 'baseline'}-${viewport}`;
        const profile = mkdtempSync(path.join(tmpdir(), 'harlem-browser-'));
        try {
          const url = `http://127.0.0.1:${address.port}/explore?viewport=${viewport}${mutation ? `&mutation=${mutation}` : ''}`;
          const { stdout, stderr } = await executeChrome(browser, chromeArgs({ profile, viewport, url }));
          writeFileSync(path.join(output, `${label}.html`), stdout);
          writeFileSync(path.join(output, `${label}.stderr.log`), stderr);
          const report = parseReport(stdout, viewport);
          reports.push({ label, report });
          writeFileSync(path.join(output, `${label}.json`), JSON.stringify(report, null, 2));
          for (const test of report.results) console.log(`${test.passed ? 'PASS' : 'FAIL'} [${label}] ${test.name}${test.error ? `\n${test.error}` : ''}`);
          if (mutation) requireMutationFailure(report, mutation);
        } finally { rmSync(profile, { recursive: true, force: true }); }
      }
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
  if (reports.some(({ label, report }) => label.startsWith('baseline-') && !report.passed)) throw new Error('Actual production browser contracts failed; see saved browser reports.');
  console.log(`Accepted both real Chrome viewports${checkMutations ? ' and rejected all three targeted source mutations' : ''}.`);
  return reports;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run({ source: process.env.HARLEM_SOURCE_ROOT ?? defaultSource, output: process.env.HARLEM_BROWSER_OUTPUT ?? path.join(here, 'dist'), checkMutations: !process.argv.includes('--no-mutations') });
}
