import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import type { EventRecord, EventPage } from '../../../content/index.ts';

// Exercise real screen/card composition; isolate renderer-specific UI primitives.
const element = `import { createElement } from ${JSON.stringify(import.meta.resolve('react'))};`;
const box = `({ children }) => createElement('div', {}, children)`;
const stubs: Record<string, string> = {
  '@acme/ui/html': `${element}
    export const Link = ({ children, href }) => createElement('a', { href }, children);
    export const Text = ${box}; export const Section = ${box};
    export const Time = ({ children, dateTime }) => createElement('time', { dateTime }, children);
    export const Nav = ({ children, ...props }) => createElement('nav', { 'aria-label': props['aria-label'] }, children);`,
  '@acme/ui/tw': `${element} export const View = ${box};`,
  '@acme/ui/mights': `${element}
    export { routes } from ${JSON.stringify(new URL('../../../../ui/mights/routes.ts', import.meta.url).href)};
    export const MightsButton = ({ children, href, ...props }) => createElement('a', { href, 'aria-current': props['aria-current'] }, children);
    export const MightsPage = ({ children, title, lead }) => createElement('main', {}, createElement('h1', {}, title), lead, children);
    export const MightsNotchCard = ${box}; export const MightsText = ${box};
    export const MightsHeading = ({ children }) => createElement('h2', {}, children);
    export const MightsLocationStamp = ({ name }) => createElement('div', {}, name);
    export const MightsEditorialImage = () => null;
    export const MightsPlaceBento = ({ modules }) => createElement('div', {}, modules.map(m => createElement('div', { key: m.id }, m.content)));`,
  '@acme/app/features/site/content/ContentLoader.tsx': `${element} export const ContentLoader = ({ label }) => createElement('div', { role: 'status' }, label);`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/features/site/') && specifier in stubs) return { url: `today-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('today-test:')) return { format: 'module', source: stubs[url.slice('today-test:'.length)]!, shortCircuit: true };
    if (url.includes('/features/site/') && url.endsWith('.tsx')) return { format: 'module', source: transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
const { TodayScreen } = await import('./TodayScreen.tsx');
const base = { date: '2026-10-12', now: new Date('2026-10-12T15:00:00Z') };
const event: EventRecord = {
  id: 1, slug: 'december-event', title: 'December performance', startsAt: '2026-12-20T00:00:00Z', endsAt: '2026-12-20T02:00:00Z', timeZone: 'America/New_York',
  status: 'scheduled', images: [], sourceUrl: 'https://example.org/listing', ticketUrl: 'https://example.org/tickets', venueName: 'Harlem venue',
  fetchedAt: '2026-10-12T12:00:00Z', lastVerifiedAt: '2026-10-12T12:00:00Z',
};
const render = (props: Partial<Parameters<typeof TodayScreen>[0]>) => renderToStaticMarkup(createElement(TodayScreen, { ...base, result: undefined, ...props }));
const page = (events: EventRecord[], extra: Partial<EventPage> = {}) => ({ status: 'ok' as const, data: { events, hasNextPage: false, totalDocs: events.length, ...extra } });

it('Upcoming shows real dates, the exact range, sources, and active URL controls', () => {
  const html = render({ view: 'upcoming', result: page([event]) });
  assert.match(html, /Upcoming in Harlem/);
  assert.match(html, /Oct 12, 2026.*Jan 9, 2027/);
  assert.match(html, /Today and the next 89 days/);
  assert.match(html, /Dec 19, 2026/);
  assert.match(html, /href="\/today\?view=upcoming" aria-current="page">Upcoming/);
  assert.match(html, /href="https:\/\/example.org\/listing"/);
  assert.match(html, /href="https:\/\/example.org\/tickets"/);
  assert.doesNotMatch(html, /From Harlem’s past|On this day in Harlem/);
});

it('Today empty state offers Upcoming, while errors and loading never claim no events', () => {
  const empty = render({ result: page([]) });
  assert.match(empty, /No events listed for today/);
  assert.match(empty, /href="\/today\?view=upcoming">See upcoming events/);
  assert.match(empty, /Today in Harlem, Monday, October 12th/);
  const failed = render({ view: 'upcoming', page: 2, result: { status: 'unavailable' } });
  assert.match(failed, /couldn’t check for events/);
  assert.match(failed, /href="\/today\?view=upcoming&amp;page=2">Try again/);
  assert.doesNotMatch(failed, /No events listed/);
  const pending = render({ view: 'upcoming' });
  assert.match(pending, /role="status">Checking for events in this date range/);
  assert.doesNotMatch(pending, /No events listed/);
});

it('pagination retains Upcoming and an empty later page offers a first-page recovery', () => {
  const html = render({ view: 'upcoming', page: 2, result: page([event], { hasNextPage: true, totalDocs: 50 }) });
  assert.match(html, /Showing 25–25 of 50 listings/);
  assert.match(html, /href="\/today\?view=upcoming">Previous page/);
  assert.match(html, /href="\/today\?view=upcoming&amp;page=3">Next page/);
  const empty = render({ view: 'upcoming', page: 3, result: page([]) });
  assert.match(empty, /No events on this page/);
  assert.match(empty, /href="\/today\?view=upcoming">First page/);
});

it('cancelled and postponed listings retain warnings/source but suppress tickets', () => {
  for (const status of ['cancelled', 'postponed'] as const) {
    const html = render({ view: 'upcoming', result: page([{ ...event, status }]) });
    assert.match(html, status === 'cancelled' ? /Cancelled/ : /Postponed/);
    assert.match(html, /https:\/\/example.org\/listing/);
    assert.doesNotMatch(html, /https:\/\/example.org\/tickets/);
  }
});
