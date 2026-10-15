import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Children, createElement, isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';
import type { WalkRecord } from '../../../content/records.ts';

// Execute the actual TSX composition, including Next's async route adapters.
// Replace leaf components with inert elements to inspect composition and props.
// This does not validate primitive rendering, navigation behavior or device UI;
// those have separate tests. No browser or CMS is mounted here.
const screenUrl = new URL('./WalksScreen.tsx', import.meta.url).href;
const rootUrl = new URL('../../../../../', import.meta.url);
const indexUrl = new URL('apps/web/app/(site)/walks/page.tsx', rootUrl).href;
const detailUrl = pathToFileURL(fileURLToPath(new URL('apps/web/app/(site)/walks/[slug]/page.tsx', rootUrl))).href;
const routeUrl = new URL('../../../../ui/mights/routes.ts', import.meta.url).href;
const components = (names: string[]) => names.map((name) => `export const ${name} = '${name}';`).join('\n');
const boundaries: Record<string, string> = {
  '@acme/ui/tw': components(['View']),
  '@acme/ui/html': components(['Link', 'Time']),
  '@acme/ui/mights': `${components(['MapAttribution', 'MightsButton', 'MightsEditorialImage', 'MightsHeading', 'MightsMapImage', 'MightsNotchCard', 'MightsPage', 'MightsPlaceBento', 'MightsText'])}\nexport { routes } from '${routeUrl}';`,
  '../../journey/WalkJourney.tsx': components(['WalkJourney']),
  '../content/ContentNotice.tsx': components(['ContentNotice']),
  '../content/SourcesList.tsx': components(['SourcesList']),
  './WalksIndex.tsx': components(['WalksIndex']),
  './WalkStops.tsx': components(['WalkStops']),
  '@acme/app/features/site/content/ContentLoader.tsx': components(['ContentLoader']),
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === screenUrl && specifier in boundaries) {
      return { url: `walk-screen-test:${specifier}`, shortCircuit: true };
    }
    if ((context.parentURL === indexUrl || context.parentURL === detailUrl) && specifier === '@/lib/cached-content') {
      return { url: new URL('./test-helpers/walk-route-content.ts', import.meta.url).href, shortCircuit: true };
    }
    if (context.parentURL === detailUrl && specifier === 'next/navigation') {
      return { url: 'walk-screen-test:not-found', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'walk-screen-test:not-found') {
      return { format: 'module', source: "export function notFound() { throw new Error('NEXT_NOT_FOUND'); }", shortCircuit: true };
    }
    if (url.startsWith('walk-screen-test:')) {
      return { format: 'module', source: boundaries[url.slice('walk-screen-test:'.length)]!, shortCircuit: true };
    }
    if ([screenUrl, indexUrl, detailUrl].includes(url)) {
      const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
      }).outputText;
      return { format: 'module', source, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { WalkScreen, WalksScreen } = await import('./WalksScreen.tsx');
const { default: WalksPage } = await import(indexUrl);
const { default: WalkPage, generateMetadata, instant } = await import(detailUrl);
const { routeContent } = await import('./test-helpers/walk-route-content.ts');
const { getHarlemArchivalImage } = await import('../../../content/editorial-images.ts');

type Element = ReactElement<{ children?: ReactNode; actions?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Element['props']>(child)) return [];
    return [child, ...elements(child.props.children), ...elements(child.props.actions)];
  });
}
function ofType(node: ReactNode, name: string): Element[] {
  return elements(node).filter((element) => element.type === name);
}
function words(node: ReactNode): string {
  return Children.toArray(node).map((child) => isValidElement<Element['props']>(child)
    ? words(child.props.children)
    : typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');
}
const date = '2026-10-01T12:00:00.000Z';
const walk: WalkRecord = {
  id: 7, slug: 'harlem-history', title: 'Harlem history', summary: 'A sourced walk.',
  distanceMeters: 1200, durationMinutes: 30, startDescription: 'Apollo Theater', endDescription: 'Schomburg Center',
  updatedAt: date,
  stops: [
    { position: 1, place: { id: 1, slug: 'apollo-theater', name: 'Apollo Theater', lngLat: [-73.95, 40.81] } },
    { position: 2, place: { id: 2, slug: 'schomburg-center', name: 'Schomburg Center', lngLat: [-73.944, 40.812] } },
    { position: 3, note: 'This stop is no longer in the catalogue.' },
  ],
  accessibility: { note: 'Check the crossing conditions before setting out.', sourceUrl: 'https://example.org/access', verifiedAt: date },
  images: [getHarlemArchivalImage('nypl-shoeshiners-lenox-avenue-1939')!, getHarlemArchivalImage('nypl-harlem-newspaper-stand-1939')!],
  sources: [{ label: 'Archive', url: 'https://example.org/history', accessedAt: date }],
};
const renderWalk = (data = walk, journeyActions?: ReactNode) => WalkScreen({ slug: data.slug, result: { status: 'ok', data }, journeyActions });

// Next leaves this async child beneath Suspense; execute it without a live read.
async function resolveContent(page: ReactElement): Promise<ReactElement> {
  assert.equal(page.type, Suspense);
  const child = (page as Element).props.children as ReactElement;
  const Content = child.type as (props: unknown) => Promise<ReactElement>;
  return Content(child.props);
}

describe('shared walk detail presentation', () => {
  it('keeps facts first, first-stop directions, sourced access and checked date', () => {
    const screen = renderWalk();
    assert.equal((Children.toArray(screen.props.children)[0] as ReactElement).type, 'MightsPlaceBento');
    assert.equal(ofType(screen, 'MightsPlaceBento')[0]!.props.variant, 'compact');
    const directions = ofType(screen, 'MightsButton').find((button) => words(button) === 'Directions to the first stop')!;
    assert.equal(directions.props.external, true);
    assert.equal(directions.props.href, 'https://www.google.com/maps/dir/?api=1&destination=40.81,-73.95&travelmode=walking');
    assert.ok(words(screen).includes('The walk starts at Apollo Theater.'));
    assert.equal(ofType(screen, 'Link')[0]!.props.href, walk.accessibility!.sourceUrl);
    assert.equal(words(ofType(screen, 'Time')[0]), 'Oct 1, 2026');
    assert.equal(ofType(screen, 'Time')[0]!.props.dateTime, date);
  });
  it('shows only sourced safe access notes and does not invent a review date', () => {
    for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,unsafe', '/relative', '', 'not a URL']) {
      const screen = renderWalk({ ...walk, accessibility: { ...walk.accessibility!, sourceUrl } });
      assert.ok(!words(screen).includes('Getting around'));
      assert.ok(!words(screen).includes(walk.accessibility!.note));
      assert.equal(ofType(screen, 'Link').length, 0);
    }
    const screen = renderWalk({ ...walk, accessibility: { ...walk.accessibility!, verifiedAt: undefined } });
    assert.ok(words(screen).includes('Getting around'));
    assert.equal(ofType(screen, 'Time').length, 0);
  });
  it('keeps the stop map, honest partial-map caption and attribution together', () => {
    const screen = renderWalk();
    const map = ofType(screen, 'MightsMapImage')[0]!;
    assert.equal(map.props.alt, 'Map of the 2 stops on Harlem history');
    assert.deepEqual(map.props.center, [-73.947, 40.811]);
    assert.equal(map.props.sizes, '(min-width: 768px) 58vw, 100vw');
    assert.deepEqual(map.props.pins, [
      { lngLat: walk.stops[0]!.place!.lngLat, tone: 'live' },
      { lngLat: walk.stops[1]!.place!.lngLat, tone: 'cobalt' },
    ]);
    assert.ok(words(screen).includes('2 of 3 stops are on the map.'));
    assert.equal(ofType(screen, 'MapAttribution').length, 1);
  });
  it('never relabels a later located stop as the start or routes to it', () => {
    const screen = renderWalk({ ...walk, stops: [{ position: 1 }, walk.stops[1]!] });
    assert.ok(!words(screen).includes('Directions to the first stop'));
    assert.ok(!words(screen).includes('the red pin is where the walk starts'));
    assert.ok(words(screen).includes('the starting stop is not on the map.'));
    assert.deepEqual(ofType(screen, 'MightsMapImage')[0]!.props.pins, [{ lngLat: walk.stops[1]!.place!.lngLat, tone: 'cobalt' }]);
  });
  it('omits unlocated maps, attribution and empty fact bentos', () => {
    const screen = renderWalk({ ...walk, stops: [], distanceMeters: 0, durationMinutes: 0, startDescription: '', endDescription: '' });
    assert.equal(ofType(screen, 'MightsMapImage').length, 0);
    assert.equal(ofType(screen, 'MapAttribution').length, 0);
    assert.equal(ofType(screen, 'MightsPlaceBento').length, 0);
    assert.ok(!words(screen).includes('Directions to the first stop'));
    const single = renderWalk({ ...walk, stops: [], distanceMeters: 0, durationMinutes: 0, endDescription: '' });
    assert.equal(ofType(single, 'MightsPlaceBento').length, 0);
    assert.ok(words(single).includes('Starts at: Apollo Theater'));
  });
  it('preserves responsive gallery layout, journey actions, ordered stops and sources', () => {
    const actions = createElement('native-actions');
    const screen = renderWalk(walk, actions);
    const images = ofType(screen, 'MightsEditorialImage');
    assert.deepEqual(images.map((image) => [image.props.ratio, image.props.sizes, image.props.priority]), [
      ['wide', '(min-width: 768px) 58vw, 100vw', true],
      ['standard', '(min-width: 768px) 42vw, 100vw', false],
    ]);
    assert.equal(images[0]!.props.image, walk.images[0]);
    const journey = ofType(screen, 'WalkJourney')[0]!;
    assert.equal(journey.props.slug, walk.slug);
    assert.equal(journey.props.platformActions, actions);
    assert.equal(ofType(screen, 'WalkStops')[0]!.props.stops, walk.stops);
    assert.equal(ofType(screen, 'SourcesList')[0]!.props.sources, walk.sources);
    const order = elements(screen).map((element) => element.type);
    assert.ok(order.indexOf('WalkJourney') < order.indexOf('WalkStops'));
  });
  it('retains journey access and native actions in loading, missing and unavailable states', () => {
    const actions = createElement('native-actions');
    for (const result of [undefined, { status: 'not-found' as const }, { status: 'unavailable' as const }]) {
      const screen = WalkScreen({ slug: walk.slug, result, journeyActions: actions });
      const journey = ofType(screen, 'WalkJourney')[0]!;
      assert.equal(journey.props.slug, walk.slug);
      assert.equal(journey.props.platformActions, actions);
      assert.equal(ofType(screen, 'WalksIndex').length, 0);
    }
  });
});

describe('shared walks index and Next route adapters', () => {
  it('keeps loading, unavailable, empty and published results distinct', () => {
    const loading = WalksScreen({ result: undefined });
    assert.equal(loading.props.title, 'Walks');
    assert.equal(ofType(loading, 'ContentLoader')[0]!.props.label, 'Checking for published walks');
    assert.equal(ofType(WalksScreen({ result: { status: 'unavailable' } }), 'ContentNotice')[0]!.props.title, 'We couldn’t check for walks right now');
    assert.equal(ofType(WalksScreen({ result: { status: 'ok', data: [] } }), 'ContentNotice')[0]!.props.title, 'No walks published yet');
    const published = [walk];
    assert.equal(ofType(WalksScreen({ result: { status: 'ok', data: published } }), 'WalksIndex')[0]!.props.walks, published);
  });
  it('streams the same index screen for the fallback and every loaded result', async () => {
    const page = WalksPage();
    assert.equal(page.props.fallback.type, WalksScreen);
    assert.equal(page.props.fallback.props.result, undefined);
    for (const result of [{ status: 'ok' as const, data: [walk] }, { status: 'ok' as const, data: [] }, { status: 'unavailable' as const }]) {
      routeContent.walks = result;
      const content = await resolveContent(page);
      assert.equal(content.type, WalksScreen);
      assert.equal((content as Element).props.result, result);
    }
  });
  it('passes detail results to the shared screen while preserving metadata and dynamic Suspense', async () => {
    const params = Promise.resolve({ slug: walk.slug });
    routeContent.walk = { status: 'ok', data: walk };
    const page = WalkPage({ params });
    assert.equal(page.props.fallback, undefined);
    assert.equal(instant, false);
    const content = await resolveContent(page);
    assert.equal(content.type, WalkScreen);
    assert.equal((content as Element).props.result, routeContent.walk);
    assert.equal((content as Element).props.slug, walk.slug);
    assert.equal(routeContent.slug, walk.slug);
    assert.deepEqual(await generateMetadata({ params }), { title: walk.title, description: walk.summary });
    routeContent.walk = { status: 'unavailable' };
    assert.equal((await resolveContent(page)).type, WalkScreen);
    assert.deepEqual(await generateMetadata({ params }), { title: 'Walk' });
  });
  it('uses Next notFound for missing records instead of soft-rendering a missing walk', async () => {
    routeContent.walk = { status: 'not-found' };
    const params = Promise.resolve({ slug: 'missing' });
    await assert.rejects(resolveContent(WalkPage({ params })), /NEXT_NOT_FOUND/);
    assert.deepEqual(await generateMetadata({ params }), { title: 'Walk' });
  });
});
