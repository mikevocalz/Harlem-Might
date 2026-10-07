// Prints median scores per preset and route from lighthouse-baseline.sh output.
// Usage: node tooling/perf/lighthouse-medians.mjs /tmp/lh
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: lighthouse-medians.mjs <dir>');

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const groups = new Map();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const [preset, route] = file.split('-');
  const r = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const key = `${preset} ${route}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({
    perf: r.categories.performance.score * 100,
    a11y: r.categories.accessibility.score * 100,
    lcp: r.audits['largest-contentful-paint'].numericValue / 1000,
    cls: r.audits['cumulative-layout-shift'].numericValue,
    tbt: r.audits['total-blocking-time'].numericValue,
  });
}

console.log('preset route | runs | perf | a11y | LCP s | CLS | TBT ms');
for (const [key, runs] of [...groups].sort()) {
  const m = (k) => median(runs.map((x) => x[k]));
  console.log(
    `${key} | ${runs.length} | ${m('perf')} | ${m('a11y')} | ${m('lcp').toFixed(2)} | ${m('cls').toFixed(3)} | ${Math.round(m('tbt'))}`,
  );
}
