import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';

// Vite has its own renderer; exercise its actual route component with only
// routing and UI primitives isolated. SSR does not run the date-refresh effect.
const fixture = {
  search: { view: 'upcoming', page: 1 },
  data: {
    now: '2026-10-12T15:00:00Z', date: '2026-10-12', range: { start: '2026-10-12', end: '2027-01-09' },
    result: { status: 'ok', data: { totalDocs: 3, hasNextPage: false, events: [
      { id: 10, title: 'Earlier cancelled', status: 'cancelled', startsAt: '2026-10-12T14:00:00Z' },
      { id: 11, title: 'Earlier postponed', status: 'postponed', startsAt: '2026-10-12T14:00:00Z' },
      { id: 12, title: 'Later scheduled', status: 'scheduled', startsAt: '2026-10-12T16:00:00Z' },
    ].map((event) => ({ ...event, endsAt: '2026-10-12T17:00:00Z', timeZone: 'America/New_York',
      lastVerifiedAt: '2026-10-12T12:00:00Z', fetchedAt: '2026-10-12T12:00:00Z', sourceUrl: 'https://example.org/event' })) } },
  },
};
Object.assign(globalThis, { __viteTodayFixture: fixture });
const element = `import { createElement } from ${JSON.stringify(import.meta.resolve('react'))};`;
const box = `({ children }) => createElement('div', {}, children)`;
const stubs: Record<string, string> = {
  '@tanstack/react-router': `${element}
    export const createFileRoute = () => options => ({ ...options, useSearch: () => globalThis.__viteTodayFixture.search, useLoaderData: () => globalThis.__viteTodayFixture.data });
    export const useRouter = () => ({}); export const Link = ${box};`,
  '@acme/ui': `${element} export const Card = ${box}; export const Text = ${box}; export const Button = ${box};
    export const Heading = ({ children, level }) => createElement('h' + level, {}, children);`,
  '@acme/ui/html': `${element} export const Link = ${box}; export const Time = ${box};`,
  '@acme/ui/tw': `${element} export const Main = ${box}; export const Nav = ${box}; export const Section = ${box}; export const View = ${box};`,
  '@/lib/events': 'export const eventReaders = {};',
};
const routeUrl = new URL('../../../web-vite/src/routes/today.tsx', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === routeUrl && specifier in stubs) return { url: `vite-today-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('vite-today-test:')) return { format: 'module', source: stubs[url.slice('vite-today-test:'.length)]!, shortCircuit: true };
    if (url === routeUrl) return { format: 'module', source: transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
// The test adapter above returns the actual component unchanged.
const { Route } = await import(routeUrl) as { Route: { component: () => React.ReactNode } };

it('Vite preserves Upcoming chronology and keeps Today status grouping', () => {
  const titles = (view: string) => {
    fixture.search.view = view;
    const html = renderToStaticMarkup(createElement(Route.component));
    return [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((match) => match[1]);
  };
  assert.deepEqual(titles('upcoming'), ['Earlier cancelled', 'Earlier postponed', 'Later scheduled']);
  assert.deepEqual(titles('today'), ['Later scheduled', 'Earlier cancelled', 'Earlier postponed']);
});
