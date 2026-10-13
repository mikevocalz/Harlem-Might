import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { names, ownership } from './observe-react';
import { MapRegion } from 'harlem-source/apps/web/components/explore/MapRegion.tsx';
import { SheetRegion } from 'harlem-source/apps/web/components/explore/SheetRegion.tsx';
import { sheetElementRef, SHEET_TITLE_ID, PHONE, DOCKED, useExploreActions } from 'harlem-source/apps/web/components/explore/explore-actions.ts';
import { focusId } from 'harlem-source/apps/web/components/explore/explore-url.ts';
import { useExplore } from 'harlem-source/packages/app/features/explore/explore.store.ts';
import { HARLEM_PLACE_PREVIEWS } from 'harlem-source/packages/app/features/explore/place-previews.ts';
import { navigationFixStore, useNavigationStore, resetNavigationStores } from 'harlem-source/packages/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from 'harlem-source/packages/app/features/navigation/view/navigationUi.store.ts';
import { useDirectionsPlaceId, useIsGuiding, useHasDevicePosition, useDirectionsView, useHudView } from 'harlem-source/packages/app/features/navigation/ui/hooks.ts';
import * as runtime from 'harlem-source/packages/app/features/navigation/view/runtime.ts';
import { parseMapboxDirections } from 'harlem-source/packages/app/features/navigation/providers/mapboxDirections.ts';
import routeFixture from 'harlem-source/packages/app/features/navigation/__fixtures__/routes/apollo-theater--sylvias-restaurant.json';

// The React test helper flushes real React work. There is no fake renderer,
// manual store-to-render bridge, DOM replacement or manual sheet ref assignment.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const expectedPhone = new URLSearchParams(location.search).get('viewport') === 'phone';
const originalExplore = useExplore.getState();
const originalUi = useNavigationUi.getState();
const catalogue = HARLEM_PLACE_PREVIEWS.filter((place) => ['apollo-theater', 'sylvias-restaurant'].includes(place.id));
const apollo = catalogue.find((place) => place.id === 'apollo-theater')!;
const sylvias = catalogue.find((place) => place.id === 'sylvias-restaurant')!;
for (const [store, name] of [[useExplore, 'explore'], [useNavigationStore, 'navigation'], [useNavigationUi, 'navigation-ui'], [navigationFixStore, 'fixes']] as const) names.set(store.subscribe, name);
const intervalIds = new Set<number>();
const realSetInterval = window.setInterval.bind(window);
const realClearInterval = window.clearInterval.bind(window);
window.setInterval = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
  const id = realSetInterval(callback, delay, ...args);
  if (delay === 30_000) intervalIds.add(id);
  return id;
}) as typeof window.setInterval;
window.clearInterval = ((id?: number) => { if (id !== undefined) intervalIds.delete(id); realClearInterval(id); }) as typeof window.clearInterval;
const browserErrors: string[] = [];
window.addEventListener('error', (event) => browserErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => browserErrors.push(String(event.reason)));
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let preserved: HTMLElement | undefined;
let probeRenders = 0;
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  assert(found, `Missing element: ${selector}`);
  return found;
}
const title = () => document.getElementById(SHEET_TITLE_ID);
function button(label: string) {
  const found = Array.from(host!.querySelectorAll<HTMLButtonElement>('button')).find((node) => (node.getAttribute('aria-label') ?? node.textContent?.trim()) === label);
  assert(found, `Missing production button: ${label}`);
  return found;
}
async function press(label: string) { await act(() => { const node = button(label); node.focus(); node.click(); }); }
async function update(fn: () => void) { await act(fn); }
async function until(predicate: () => boolean, message: string) {
  for (let i = 0; i < 80 && !predicate(); i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  assert(predicate(), message);
}
const mapped = catalogue.map((place) => ({ id: place.id, name: place.name, lngLat: place.lngLat! }));
function Shell() {
  const actions = useExploreActions();
  return <>
    <header id="test-header"><input aria-label="Search" data-explore-focus="search" /><button id="outside-control">Outside</button></header>
    <main><div id="test-map">{catalogue.map((place) => <button key={place.id} data-explore-focus={focusId.row(place.id)} onClick={() => actions.select(place.id, focusId.row(place.id))}>Select {place.name}</button>)}<MapRegion points={mapped} /></div><SheetRegion catalogue={catalogue} /></main>
  </>;
}
function HookProbe() {
  const place = useDirectionsPlaceId();
  const guiding = useIsGuiding();
  const position = useHasDevicePosition();
  const directions = useDirectionsView(apollo, undefined);
  const hud = useHudView();
  probeRenders++;
  return <output id="hook-probe" data-place={place ?? ''} data-guiding={String(guiding)} data-position={String(position)} data-directions={directions.kind} data-hud={hud.kind} />;
}
function SecondClockConsumer() { useHudView(); return null; }
async function unmount() {
  const inertOwned = [document.getElementById('test-header'), document.getElementById('test-map'), document.getElementById('browser-results')].filter((node): node is HTMLElement => node !== null);
  if (root) { await act(() => root!.unmount()); root = undefined; }
  assert(sheetElementRef.current === null, 'React must release the shared sheet ref on unmount');
  for (const node of inertOwned) assert(!node.hasAttribute('inert'), `Unmount leaked owned inert on ${node.id}`);
  if (preserved) assert(preserved.hasAttribute('inert'), 'Unmount removed inert owned by another surface');
  host?.remove(); host = undefined; preserved?.remove(); preserved = undefined;
  for (const [name, row] of ownership) assert(row.active === 0, `Leaked ${name} subscription after unmount: ${JSON.stringify(row)}`);
  assert(intervalIds.size === 0, 'The last navigation hook must stop the shared clock');
  runtime.resetNavigationRuntimeForTests(); resetNavigationStores();
  useNavigationUi.setState(originalUi, true); useExplore.setState(originalExplore, true);
}
async function mount({ place = apollo.id, probe = false } = {}) {
  await unmount();
  history.replaceState(null, '', `/explore?q=jazz${place ? `&place=${place}` : ''}`);
  preserved = document.createElement('aside'); preserved.id = 'foreign-inert'; preserved.setAttribute('inert', ''); document.body.append(preserved);
  host = document.createElement('div'); host.id = 'test-root'; document.body.append(host);
  root = createRoot(host);
  await act(() => root!.render(<StrictMode>{probe ? <><HookProbe /><SecondClockConsumer /></> : <Shell />}</StrictMode>));
}
const parsed = parseMapboxDirections(routeFixture.response, 'walking', () => 'browser-test-route');
assert(parsed.kind === 'routes', 'Production recorded route must parse');
const route = parsed.routes[0]!;
function guide() {
  // A real trip always has a controller; retain its cancel/end ownership even
  // though this fixture injects a recorded session instead of calling a service.
  runtime.navigationController();
  useNavigationStore.setState({ session: {
    phase: 'navigating', origin: { kind: 'manual', coordinate: route.geometry.coordinates[0]!, label: apollo.name },
    destination: { name: sylvias.name, placeId: sylvias.id, coordinate: { longitude: sylvias.lngLat![0], latitude: sylvias.lngLat![1] } }, mode: 'walking',
    activeRoute: { route, alternatives: [], generation: 1, receivedAtMs: Date.now() },
    deviation: { kind: 'on-route' }, arrival: { kind: 'en-route', distanceM: route.distanceM }, reroute: { kind: 'idle' },
  } });
}

const cases: Array<[string, () => Promise<void>]> = [
  ['real browser, responsive media and React ref ownership', async () => {
    assert(/(?:Chrome|Chromium)\//.test(navigator.userAgent), 'This gate must run in real Chrome/Chromium');
    assert(window.matchMedia(PHONE).matches === expectedPhone, `Incorrect viewport: innerWidth=${innerWidth}`);
    assert(window.matchMedia(DOCKED).matches === !expectedPhone, 'The second viewport must be docked desktop');
    await mount();
    assert(sheetElementRef.current instanceof HTMLElement, 'Production View did not forward a real DOM ref');
    assert(sheetElementRef.current === element('[role="dialog"]'), 'Shared ref must own the committed sheet element');
    assert(document.activeElement === title(), 'Opening selection must focus the real heading');
  }],
  ['Back restores the newly committed heading, repeatedly and while modal', async () => {
    await mount();
    if (expectedPhone) await update(() => useExplore.getState().setSheetDetent('full'));
    for (let pass = 0; pass < 3; pass++) {
      await press('Directions');
      assert(title() === null, 'Directions must remove the old details heading');
      await press(`Back to ${apollo.name}`);
      assert(title()?.getAttribute('tabindex') === '-1', 'Returned heading must be focusable');
      assert(document.activeElement === title(), 'Back must focus the new heading after React commits it');
      assert(useNavigationUi.getState().directionsPlaceId === null, 'Back must close directions');
    }
    if (expectedPhone) {
      assert(element('#test-map').inert && element('#test-header').inert, 'Modal ownership was lost across Back');
      await update(() => useExplore.getState().setSheetDetent('half'));
    }
    element<HTMLInputElement>('[data-explore-focus="search"]').focus();
    await update(() => useNavigationUi.getState().setOnline(false));
    assert(document.activeElement?.getAttribute('data-explore-focus') === 'search', 'Consumed Back intent stole focus on an unrelated update');
  }],
  ['Back requests superseded by a different or removed URL selection cannot replay', async () => {
    await mount(); await press('Directions');
    await update(() => { button(`Back to ${apollo.name}`).click(); history.replaceState(null, '', `/explore?q=jazz&place=${sylvias.id}`); });
    assert(title()?.textContent === sylvias.name, 'The newer selection must own the details');
    assert(document.activeElement === title(), 'The newer selection must own focus');
    await press('Directions');
    await update(() => { button(`Back to ${sylvias.name}`).click(); history.replaceState(null, '', '/explore?q=jazz'); });
    assert(title() === null && sheetElementRef.current === null, 'A removed selection cannot leave stale details/ref');
    assert(document.activeElement?.getAttribute('data-explore-focus') === focusId.row(sylvias.id), 'URL removal must restore the selected place row');
    await press(`Select ${apollo.name}`);
    assert(title()?.textContent === apollo.name && document.activeElement === title(), 'Reopen must belong to the new selection');
  }],
  ['guidance supersedes Back; ending it cannot replay an old focus request', async () => {
    await mount({ place: sylvias.id }); await press('Directions');
    await update(() => { button(`Back to ${sylvias.name}`).click(); guide(); });
    assert(title() === null, 'Guidance must not show stale details');
    if (expectedPhone) assert(sheetElementRef.current === null, 'Phone guidance must release the hidden sheet ref');
    else assert(sheetElementRef.current !== null, 'Desktop guidance keeps the docked inspector');
    const search = element<HTMLInputElement>('[data-explore-focus="search"]'); search.focus();
    await update(() => runtime.endNavigation());
    assert(title()?.textContent === sylvias.name, 'Ending guidance must restore the selected details');
    assert(document.activeElement === search, 'An old Back request replayed after guidance');
  }],
  ['full phone modal releases and reacquires inert when guidance hides/reveals it', async () => {
    if (!expectedPhone) return;
    await mount({ place: sylvias.id });
    await update(guide);
    assert(sheetElementRef.current === null, 'Phone guidance must start with the map exposed');
    // Click production NavigationHud and MapRegion's real Steps callback:
    // it opens steps and expands full. No test writes that detent for this case.
    await press('Steps');
    assert(useExplore.getState().sheet.detent === 'full', 'Production Steps must expand the sheet');
    assert(sheetElementRef.current === element('[role="dialog"]'), 'Steps must assign a real mounted sheet ref');
    const outside = element<HTMLButtonElement>('#outside-control');
    const dismiss = button('Show the map'); dismiss.focus(); outside.focus();
    assert(document.activeElement === dismiss, 'The browser must prevent focus entering inert outside content');
    assert(element('#test-map').inert && element('#test-header').inert, 'Full Steps must own map/header inert');
    await press('Show the map');
    assert(useNavigationStore.getState().session.phase === 'navigating', 'Map dismissal must preserve the active trip');
    assert(sheetElementRef.current === null, 'Map dismissal must unmount the sheet DOM');
    assert(!element('#test-map').inert && !element('#test-header').inert, 'Hidden full sheet left the map/header inert');
    outside.focus(); assert(document.activeElement === outside, 'Map dismissal must let outside content take focus');
    await press('Steps');
    assert(sheetElementRef.current === element('[role="dialog"]'), 'Repeated Steps must assign its new ref');
    assert(element('#test-map').inert && element('#test-header').inert, 'Repeated Steps must reacquire inert');
    await press('Show the map');
    assert(sheetElementRef.current === null && !element('#test-map').inert, 'Repeated Map dismissal must release ref and inert');
    assert(preserved!.inert, 'Modal cleanup must preserve someone else’s inert');
  }],
  ['native History Back/Forward, Escape guards and focus return', async () => {
    await mount({ place: '' });
    await press(`Select ${apollo.name}`);
    assert(new URLSearchParams(location.search).get('q') === 'jazz', 'Select must preserve query');
    await update(() => history.back());
    await until(() => title() === null && new URLSearchParams(location.search).get('place') === null, 'Native History Back did not remove selection');
    assert(document.activeElement?.getAttribute('data-explore-focus') === focusId.row(apollo.id), 'Native Back must restore the actual visible opener');
    await update(() => history.forward());
    await until(() => title()?.textContent === apollo.name, 'Native History Forward did not restore selection');
    assert(document.activeElement === title(), 'Forward must focus details');
    for (const kind of ['prevented', 'composing', 'search']) {
      await update(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: kind === 'composing' });
        if (kind === 'prevented') event.preventDefault();
        (kind === 'search' ? element('[data-explore-focus="search"]') : title()!).dispatchEvent(event);
      });
      assert(title() !== null, `Escape must ignore ${kind} events`);
    }
    await update(() => title()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await until(() => title() === null, 'Escape did not close details');
    assert(document.activeElement?.getAttribute('data-explore-focus') === focusId.row(apollo.id), 'Escape must restore opener focus');
    assert(new URLSearchParams(location.search).get('q') === 'jazz', 'Close must preserve query');
  }],
  ['actual useSyncExternalStore owns updates, selectors, StrictMode cleanup and shared clock', async () => {
    const beforeMount = new Map([...ownership].map(([name, row]) => [name, { added: row.added, removed: row.removed }]));
    await mount({ probe: true });
    assert(intervalIds.size === 1, 'Multiple mounted navigation consumers must share exactly one 30-second clock');
    for (const name of ['navigation', 'navigation-ui', 'fixes']) {
      const row = ownership.get(name);
      const previous = beforeMount.get(name) ?? { added: 0, removed: 0 };
      assert(row && row.active > 0 && row.removed > previous.removed && row.added - previous.added > row.active, `Real ${name} subscription must survive this mount's StrictMode cleanup/remount`);
    }
    await update(() => useNavigationUi.getState().openDirections(apollo.id));
    assert(element('#hook-probe').dataset.place === apollo.id, 'UI store publication must rerender the subscribed production hook');
    await update(guide);
    assert(element('#hook-probe').dataset.place === sylvias.id, 'The session destination must outrank the opened directions place');
    assert(element('#hook-probe').dataset.guiding === 'true', 'Active trip must update the real guiding hook');
    assert(element('#hook-probe').dataset.position === 'false', 'No fix must mean no device position');
    await update(() => navigationFixStore.setState({ lastFix: { kind: 'rejected', reason: 'inaccurate', fix: { coordinate: route.geometry.coordinates[0]!, accuracy: { horizontalM: 120 }, timestampMs: Date.now(), source: 'device-gps' } } }));
    assert(element('#hook-probe').dataset.position === 'true', 'A usable coarse fix must update the production position hook');
    const before = probeRenders;
    await update(() => { for (let i = 0; i < 20; i++) navigationFixStore.setState({ heading: undefined }); });
    assert(probeRenders === before, 'Unchanged selected per-fix boolean must not rerender a panel');
    await update(() => navigationFixStore.setState({ lastFix: undefined }));
    assert(element('#hook-probe').dataset.position === 'false', 'Clearing the fix must publish unavailable position');
    await update(() => runtime.endNavigation());
    assert(element('#hook-probe').dataset.guiding === 'false' && element('#hook-probe').dataset.place === '', 'Ending guidance must publish fresh idle hook state');
    await unmount();
    const deliveries = [...ownership.values()].reduce((sum, row) => sum + row.delivered, 0);
    useNavigationUi.getState().openDirections(apollo.id); guide(); navigationFixStore.setState({ heading: undefined });
    assert([...ownership.values()].reduce((sum, row) => sum + row.delivered, 0) === deliveries, 'An unmounted consumer still received an external-store notification');
  }],
];

void (async () => {
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];
  for (const [name, run] of cases) {
    try { await run(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error instanceof Error ? error.stack : error) }); }
    finally {
      try { await unmount(); }
      catch (error) { results.push({ name: `${name}: teardown`, passed: false, error: String(error) }); }
    }
  }
  for (const error of browserErrors) results.push({ name: 'Uncaught browser error', passed: false, error });
  const report = { viewport: expectedPhone ? 'phone' : 'desktop', innerWidth, userAgent: navigator.userAgent, reactVersion: React.version, results, subscriptions: Object.fromEntries(ownership) };
  const output = element<HTMLPreElement>('#browser-results');
  output.dataset.status = results.every((result) => result.passed) ? 'passed' : 'failed';
  output.textContent = btoa(unescape(encodeURIComponent(JSON.stringify(report))));
  document.title = `Harlem browser contracts: ${output.dataset.status}`;
})();
