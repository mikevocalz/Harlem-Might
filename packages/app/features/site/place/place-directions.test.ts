import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';

// Render the real visit card; replace only presentation primitives and sibling
// media/hours views, keeping the production button text and destination props.
const reactUrl = import.meta.resolve('react');
const element = `import { createElement } from ${JSON.stringify(reactUrl)};`;
const box = '({ children }) => createElement("div", {}, children)';
const stubs: Record<string, string> = {
  '@acme/app/content': 'export const HARLEM_ARCHIVAL_IMAGES = [];',
  '@acme/ui': 'export const Badge = () => null;',
  '@acme/ui/html': `${element} export const Section = ${box}; export const Link = ({ children, href }) => createElement('a', { href }, children);`,
  '@acme/ui/tw': `${element} export const View = ${box};`,
  '@acme/ui/mights': `${element}
    export const MightsButton = ({ children, href, external }) => createElement('a', { href, 'data-external': external ? 'true' : undefined }, children);
    export const MightsNotchCard = ${box}; export const MightsHeading = ${box}; export const MightsText = ${box};
    export const MightsLocationStamp = () => null; export const MapAttribution = () => null;
    export const MightsEditorialImage = () => null; export const MightsMapImage = () => null;
    export const mapboxStaticUrl = () => undefined;
    export const routes = { explore: ({ place, category }) => '/explore?' + new URLSearchParams(place ? { place } : { category }) };`,
  './PlaceGallery.tsx': 'export const PlaceGallery = () => null;',
  './PlaceHours.tsx': 'export const PlaceHours = () => null;',
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/PlaceHero.tsx') && specifier in stubs) {
      return { url: `place-directions-test:${specifier}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('place-directions-test:')) return { format: 'module', source: stubs[url.slice('place-directions-test:'.length)]!, shortCircuit: true };
    if (url.endsWith('/PlaceHero.tsx')) return { format: 'module', source: transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    return next(url, context);
  },
});
const { PlaceVisit } = await import('./PlaceHero.tsx');
const place = { id: 'apollo', name: 'Apollo', area: 'Harlem', category: 'Landmarks', tags: [], lngLat: [-73.95, 40.81] as [number, number] };
const render = (lngLat: [number, number] | undefined) => renderToStaticMarkup(createElement(PlaceVisit, { place: { ...place, lngLat }, hasPhotos: true, now: new Date('2026-10-11T12:00:00Z') }));

it('external Google Maps directions are clearly labelled without changing their destination', () => {
  const html = render(place.lngLat);
  assert.match(html, /<a href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=40\.81,-73\.95" data-external="true">Get directions<\/a>/);
  assert.doesNotMatch(html, /Take Me There/);
  assert.match(html, /href="\/explore\?place=apollo">See it on the map/);
});

it('a place without coordinates does not offer an external directions action', () => {
  const html = render(undefined);
  assert.doesNotMatch(html, /google\.com\/maps\/dir|Get directions|Take Me There/);
  assert.match(html, /Directions open once the location is verified/);
});
