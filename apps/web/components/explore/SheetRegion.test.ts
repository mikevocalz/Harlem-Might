import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { DEFAULT_SHEET_DETENT, useExplore } from '@acme/app/features/explore/explore.store.ts';
import { HARLEM_PLACE_PREVIEWS } from '@acme/app/features/explore/place-previews.ts';
import { navigationFixStore, resetNavigationStores, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { fixtureDestination, fixtureRoute } from '@acme/app/features/navigation/testing/fixtures.ts';
import * as directionsView from '@acme/app/features/navigation/view/directionsView.ts';
import * as hudView from '@acme/app/features/navigation/view/hudView.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import * as runtime from '@acme/app/features/navigation/view/runtime.ts';
import * as exploreUrl from './explore-url.ts';

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: readonly unknown[]; effect?: Effect; cleanup?: void | (() => void) };
type Props = { children?: Child; ref?: { current: FakeElement | null }; [key: string]: unknown };
type VNode = { type: string | symbol | ((props: Props) => Child); props: Props };
type Child = VNode | string | number | boolean | null | undefined | Child[];
type KeyEvent = { key: string; defaultPrevented?: boolean; isComposing?: boolean; target?: FakeElement };
type Actions = { select: (id: string, opener: string) => void; close: () => void; params: URLSearchParams };
const initialExplore = useExplore.getState();
const initialUi = useNavigationUi.getState();
const cleanups = new Set<() => void>();
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups.clear();
  runtime.resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.setState(initialUi);
  useExplore.setState(initialExplore);
});
const catalogue = HARLEM_PLACE_PREVIEWS.filter((p) => ['apollo-theater', 'sylvias-restaurant'].includes(p.id));
const [apollo, sylvias] = ['apollo-theater', 'sylvias-restaurant'].map((id) => catalogue.find((p) => p.id === id)!);
const compile = (file: string) => transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022 },
}).outputText;
const sources = {
  actions: compile('./explore-actions.ts'), sheet: compile('./SheetRegion.tsx'),
  panel: compile('../../../../packages/app/features/navigation/ui/DirectionsPanel.tsx'),
  hooks: compile('../../../../packages/app/features/navigation/ui/hooks.ts'),
};

class FakeElement {
  readonly attributes = new Map<string, string>();
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  props: Props = {};
  text = '';
  visible = true;
  focusCount = 0;
  readonly tag: string;
  readonly onFocus: (element: FakeElement) => void;
  constructor(tag: string, onFocus: (element: FakeElement) => void) { this.tag = tag; this.onFocus = onFocus; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  focus() {
    if (!this.parentElement || this.closest('[inert]')) return;
    if (this.tag === 'MightsHeading' && !this.hasAttribute('tabindex')) return;
    this.focusCount++; this.onFocus(this);
  }
  getClientRects() { return this.visible ? [{}] : []; }
  closest(selector: string): FakeElement | null {
    const match = selector.match(/^\[([^=\]]+)(?:="(.*)")?\]$/);
    if (match && this.hasAttribute(match[1]!) && (match[2] === undefined || this.attributes.get(match[1]!) === match[2])) return this;
    return this.parentElement?.closest(selector) ?? null;
  }
}

// Execute the production sheet, DirectionsPanel, navigation hooks, URL actions,
// runtime and stores. The renderer fakes React/DOM only: render is separate from
// commit, focus is lost when a focused node unmounts, and effects run after the
// new heading/ref is mounted. These are Node behavioral contracts, not browser QA.
function fixture({ phone = false, docked = true, search = `?place=${apollo.id}` } = {}) {
  let active: FakeElement;
  const body = new FakeElement('body', (element) => { active = element; });
  active = body;
  const element = (tag: string, parent = body) => {
    const node = new FakeElement(tag, (next) => { active = next; });
    node.parentElement = parent; parent.children.push(node); return node;
  };
  const header = element('header');
  const preservedInert = element('aside'); preservedInert.setAttribute('inert', '');
  const workspace = element('main');
  const map = element('map', workspace);
  const searchField = element('input', header); searchField.setAttribute('data-explore-focus', 'search');
  const openers = new Map(catalogue.map((place) => {
    const row = element('button', map); row.setAttribute('data-explore-focus', exploreUrl.focusId.row(place.id)); return [place.id, row];
  }));
  let sheetRoot: FakeElement | null = null;
  const walk = (node: FakeElement): FakeElement[] => [node, ...node.children.flatMap(walk)];
  const listeners = new Set<(event: KeyEvent) => void>();
  const document = {
    body, get activeElement() { return active; },
    getElementById: (id: string) => walk(body).find((node) => node.attributes.get('id') === id) ?? null,
    querySelector: (selector: string) => walk(body).find((node) => node.closest(selector) === node) ?? null,
    addEventListener: (_type: string, listener: (event: KeyEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: KeyEvent) => void) => listeners.delete(listener),
  };
  let index = 0;
  const history = [new URL(`/explore${search}`, 'https://harlem.invalid')];
  let dirty = true;
  let mounted = true;
  const browser = {
    get location() { return history[index]!; },
    history: {
      replaceState(_state: unknown, _title: string, href: string) { history[index] = new URL(href, browser.location); dirty = true; },
      pushState(_state: unknown, _title: string, href: string) { const url = new URL(href, browser.location); history.splice(++index, Infinity, url); dirty = true; },
      back() { if (index > 0) { index--; dirty = true; } },
      forward() { if (index < history.length - 1) { index++; dirty = true; } },
    },
  };
  const instances = new Map<string, Slot[]>();
  let slots: Slot[] = [];
  let cursor = 0;
  let effects: Slot[] = [];
  const next = () => slots[cursor++] ?? (slots[cursor - 1] = {});
  const same = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useEffect(effect: Effect, deps?: readonly unknown[]) {
      const slot = next(); slot.effect = effect;
      if (!same(slot.deps, deps)) { slot.deps = deps; effects.push(slot); }
    },
    useRef(value: unknown) { const slot = next(); return slot.value ?? (slot.value = { current: value }); },
    useMemo(compute: () => unknown, deps: readonly unknown[]) {
      const slot = next(); if (!same(slot.deps, deps)) { slot.deps = deps; slot.value = compute(); } return slot.value;
    },
    useState(initial: unknown) {
      const slot = next(); if (!('value' in slot)) slot.value = initial;
      return [slot.value, (value: unknown) => { slot.value = typeof value === 'function' ? value(slot.value) : value; dirty = true; }];
    },
    useSyncExternalStore(_subscribe: unknown, read: () => unknown) { return read(); },
  };
  const jsx = (type: VNode['type'], props: Props): VNode => ({ type, props });
  const store = <T,>(source: { getState(): T }) => Object.assign((select: (state: T) => unknown) => select(source.getState()), source);
  const modules: Record<string, unknown> = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: Symbol('Fragment') },
    zustand: { useStore: (source: { getState(): unknown }, select: (state: unknown) => unknown) => select(source.getState()) },
    'zustand/react/shallow': { useShallow: (select: unknown) => select },
    '@acme/app/features/explore/explore.store.ts': { DEFAULT_SHEET_DETENT, useExplore: store(useExplore) },
    '@acme/app/features/navigation/view/navigationUi.store.ts': { useNavigationUi: store(useNavigationUi) },
    '../view/navigationUi.store': { useNavigationUi: store(useNavigationUi) },
    '../session/navigationStore': { useNavigationStore: store(useNavigationStore), navigationFixStore },
    '@acme/app/features/navigation/view/runtime.ts': runtime, '../view/runtime': runtime,
    '../view/directionsView': directionsView, '../view/hudView': hudView,
    '../../explore/explore-type': { useExploreType: () => ({ buttons: { primary: 'sm', control: 'sm' } }) },
    './ManeuverIcon': { ManeuverIcon: 'ManeuverIcon' },
    '@acme/ui/tw': Object.fromEntries(['View', 'ScrollView', 'Pressable', 'Text'].map((name) => [name, name])),
    '@acme/ui/mights': {
      ...Object.fromEntries(['MapAttribution', 'MightsButton', 'MightsHeading', 'MightsLocationStamp', 'MightsMapImage', 'MightsText'].map((name) => [name, name])),
      routes: { explore: () => '/explore', place: (id: string) => `/places/${id}` },
    },
    './explore-url': exploreUrl,
    './use-media-query': { useMediaQuery: (query: string) => query.includes('<') ? phone : docked },
    'solito/navigation': {
      usePathname: () => browser.location.pathname,
      useSearchParams: () => new URLSearchParams(browser.location.search),
      useRouter: () => ({ back: browser.history.back }),
    },
  };
  function load<T>(source: string): T {
    const exports = {};
    new Function('require', 'exports', 'document', 'window', 'Element', 'CSS', source)((id: string) => {
      assert.ok(id in modules, `Unexpected import: ${id}`); return modules[id];
    }, exports, document, browser, FakeElement, { escape: (id: string) => id });
    return exports as T;
  }
  modules['./hooks'] = modules['@acme/app/features/navigation/ui/hooks.ts'] = load(sources.hooks);
  modules['@acme/app/features/navigation/ui/DirectionsPanel.tsx'] = load(sources.panel);
  const actions = load<{ useExploreActions: () => Actions; sheetElementRef: { current: FakeElement | null }; SHEET_TITLE_ID: string }>(sources.actions);
  modules['./explore-actions'] = actions;
  const { SheetRegion } = load<{ SheetRegion: (props: Props) => Child }>(sources.sheet);
  const unsubscribe = [useExplore, useNavigationUi, useNavigationStore, navigationFixStore].map((source) => source.subscribe(() => { dirty = true; }));
  let tree: Child;
  let visited = new Set<string>();
  function render(child: Child, path: string): Child {
    if (Array.isArray(child)) return child.map((node, i) => render(node, `${path}.${i}`));
    if (!child || typeof child !== 'object') return child;
    if (typeof child.type === 'function') {
      const key = `${path}:${child.type.name}`;
      visited.add(key); slots = instances.get(key) ?? []; instances.set(key, slots); cursor = 0;
      return render(child.type(child.props), `${key}.child`);
    }
    return { ...child, props: { ...child.props, children: render(child.props.children, `${path}.children`) } };
  }
  function materialize(child: Child, parent: FakeElement, previous?: FakeElement): FakeElement[] {
    if (Array.isArray(child)) return child.flatMap((node, i) => materialize(node, parent, previous?.children[i]));
    if (!child || typeof child !== 'object') return [];
    if (typeof child.type === 'symbol') return materialize(child.props.children, parent, previous);
    const compatible = previous?.tag === child.type && previous.props.id === child.props.id && previous.props['aria-label'] === child.props['aria-label'];
    const node = compatible ? previous! : new FakeElement(String(child.type), (next) => { active = next; });
    node.parentElement = parent; node.props = child.props;
    for (const [key, value] of Object.entries(child.props)) if (key === 'id' || key.startsWith('aria-')) node.setAttribute(key, String(value));
    const text = (value: Child): string => Array.isArray(value) ? value.map(text).join('') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    node.text = text(child.props.children);
    const children = child.props.children;
    node.children = Array.isArray(children)
      ? children.flatMap((value, i) => materialize(value, node, node.children[i]))
      : materialize(children, node, node.children[0]);
    return [node];
  }
  function renderOnly() {
    dirty = false; visited = new Set(); effects = [];
    tree = render(jsx(SheetRegion, { catalogue }), 'sheet');
  }
  function commit() {
    if (!mounted) return;
    const previousNodes = sheetRoot ? walk(sheetRoot) : [];
    sheetRoot = materialize(tree, workspace, sheetRoot ?? undefined)[0] ?? null;
    workspace.children = [map, ...(sheetRoot ? [sheetRoot] : [])];
    const live = new Set(walk(body));
    for (const old of previousNodes) if (!live.has(old)) old.parentElement = null;
    if (!live.has(active)) active = body;
    actions.sheetElementRef.current = sheetRoot;
    for (const [key, instance] of instances) if (!visited.has(key)) { instance.forEach((slot) => slot.cleanup?.()); instances.delete(key); }
    for (const slot of effects) slot.cleanup?.();
    for (const slot of effects) slot.cleanup = slot.effect?.();
    effects = [];
  }
  function flush() {
    let commits = 0;
    while (mounted && dirty) { assert.ok(++commits < 20, 'Render must settle'); renderOnly(); commit(); }
  }
  function replayEffects() {
    const mountedEffects = [...instances.values()].flat().filter((slot) => slot.effect);
    mountedEffects.forEach((slot) => slot.cleanup?.());
    mountedEffects.forEach((slot) => { slot.cleanup = slot.effect?.(); });
  }
  function unmount() {
    if (!mounted) return;
    mounted = false; unsubscribe.forEach((stop) => stop());
    instances.forEach((instance) => instance.forEach((slot) => slot.cleanup?.())); instances.clear(); effects = [];
    if (sheetRoot && walk(sheetRoot).includes(active)) active = body;
    workspace.children = [map]; actions.sheetElementRef.current = null;
  }
  const find = (label: string) => walk(body).find((node) => node.props['aria-label'] === label || node.text === label);
  cleanups.add(unmount);
  flush();
  return {
    document, browser, header, map, preservedInert, searchField, openers, listeners, flush, renderOnly, commit, replayEffects, unmount,
    actions: actions.useExploreActions, find,
    title: () => document.getElementById(actions.SHEET_TITLE_ID),
    press(label: string) { const node = find(label); assert.ok(node, `Missing button ${label}`); node.focus(); (node.props.onPress as () => void)(); },
    key(event: KeyEvent) { listeners.forEach((listener) => listener(event)); },
  };
}

function guide() {
  const route = fixtureRoute('apollo-theater--sylvias-restaurant');
  useNavigationStore.setState({ session: {
    phase: 'navigating', origin: { kind: 'manual', coordinate: route.geometry.coordinates[0]!, label: apollo.name },
    destination: fixtureDestination('apollo-theater--sylvias-restaurant'), mode: 'walking',
    activeRoute: { route, alternatives: [], generation: 1, receivedAtMs: 1_760_000_000_000 },
    deviation: { kind: 'on-route' }, arrival: { kind: 'en-route', distanceM: route.distanceM }, reroute: { kind: 'idle' },
  } });
}

describe('SheetRegion directions focus ownership', () => {
  it('focuses the newly committed, focusable heading on Back to the same place, including repeated visits', () => {
    const f = fixture();
    assert.equal(f.document.activeElement, f.title());
    for (let repeat = 0; repeat < 2; repeat++) {
      f.press('Directions'); f.flush();
      assert.equal(f.title(), null);
      f.press(`Back to ${apollo.name}`);
      assert.equal(f.title(), null, 'The dismiss callback precedes the details commit');
      f.renderOnly();
      assert.equal(f.title(), null, 'Rendering alone must not focus an uncommitted heading');
      f.commit(); f.flush();
      assert.ok(f.title());
      assert.equal(f.title()!.attributes.get('tabindex'), '-1');
      assert.equal(f.document.activeElement, f.title());
    }
  });

  it('does not steal focus on unrelated rerenders after handling Back', () => {
    const f = fixture();
    f.press('Directions'); f.flush(); f.press(`Back to ${apollo.name}`); f.flush();
    const heading = f.title()!;
    const focusCount = heading.focusCount;
    f.searchField.focus(); f.replayEffects();
    assert.equal(f.document.activeElement, f.searchField, 'Activity or effect replay preserves valid same-place focus');
    useExplore.getState().setSheetDetent('full'); f.flush();
    useNavigationUi.getState().setMode('cycling'); f.flush();
    assert.equal(f.document.activeElement, f.searchField);
    assert.equal(heading.focusCount, focusCount);
  });

  it('lets a newer selection own focus and never replays the old Back request', () => {
    const f = fixture();
    f.press('Directions'); f.flush(); f.press(`Back to ${apollo.name}`);
    f.actions().select(sylvias.id, exploreUrl.focusId.row(sylvias.id)); f.flush();
    assert.equal(f.title()!.text, sylvias.name);
    assert.equal(f.document.activeElement, f.title());
    f.browser.history.back(); f.flush();
    f.searchField.focus(); useExplore.getState().setSheetDetent('full'); f.flush();
    assert.equal(f.document.activeElement, f.searchField);
  });

  it('drops pending focus when closed or unmounted before the details commit', () => {
    const f = fixture({ search: '' });
    f.actions().select(apollo.id, exploreUrl.focusId.row(apollo.id)); f.flush();
    f.press('Directions'); f.flush(); f.press(`Back to ${apollo.name}`);
    f.actions().close(); f.flush();
    assert.equal(f.title(), null);
    assert.equal(f.document.activeElement, f.openers.get(apollo.id));
    assert.equal(useExplore.getState().selectionPushed, false);
    f.browser.history.forward(); f.flush();
    f.press('Directions'); f.flush(); f.press(`Back to ${apollo.name}`);
    f.renderOnly(); f.unmount(); f.searchField.focus(); f.commit();
    assert.equal(f.document.activeElement, f.searchField);
    assert.equal(f.listeners.size, 0);
  });

  it('keeps guidance Map dismissal and desktop guidance owned by the trip', () => {
    const f = fixture({ docked: false, search: `?place=${sylvias.id}` });
    guide(); useNavigationUi.getState().setStepsOpen(true); f.flush();
    f.press('Show the map'); f.flush();
    assert.equal(useNavigationUi.getState().stepsOpen, false);
    assert.equal(useNavigationStore.getState().session.phase, 'navigating');
    assert.equal(f.title(), null);
    f.unmount();
    const desktop = fixture({ search: `?place=${sylvias.id}` });
    assert.equal(desktop.find('Show the map'), undefined);
    assert.equal(desktop.title(), null);
    assert.equal(useNavigationStore.getState().session.phase, 'navigating');
  });

  it('releases phone modal ownership when full Steps hides, and reacquires it on reopening', () => {
    const f = fixture({ phone: true, docked: false, search: `?place=${sylvias.id}` });
    guide();
    for (let repeat = 0; repeat < 2; repeat++) {
      // Match the production HUD Steps callback: reveal and expand the sheet.
      useNavigationUi.getState().setStepsOpen(true);
      useExplore.getState().setSheetDetent('full');
      f.flush();
      assert.equal(f.map.hasAttribute('inert'), true);
      assert.equal(f.header.hasAttribute('inert'), true);
      f.press('Show the map'); f.flush();
      assert.equal(useNavigationUi.getState().stepsOpen, false);
      assert.equal(useNavigationStore.getState().session.phase, 'navigating');
      assert.equal(f.find('Show the map'), undefined);
      assert.equal(f.map.hasAttribute('inert'), false, 'the hidden modal must release its map/HUD sibling');
      assert.equal(f.header.hasAttribute('inert'), false);
      assert.equal(f.preservedInert.hasAttribute('inert'), true);
      f.openers.get(sylvias.id)!.focus();
      assert.equal(f.document.activeElement, f.openers.get(sylvias.id));
    }
  });

  it('discards a Back request superseded by guidance before commit', () => {
    const f = fixture({ docked: false, search: `?place=${sylvias.id}` });
    f.press('Directions'); f.flush(); f.press(`Back to ${sylvias.name}`);
    guide(); f.flush(); f.searchField.focus();
    runtime.endNavigation(); f.flush();
    assert.ok(f.title());
    assert.equal(f.document.activeElement, f.searchField);
  });

  it('preserves modal inert ownership, Escape guards and history focus return', () => {
    const f = fixture({ phone: true, docked: false, search: '?q=jazz' });
    f.actions().select(apollo.id, exploreUrl.focusId.row(apollo.id)); f.flush();
    useExplore.getState().setSheetDetent('full'); f.flush();
    assert.equal(f.map.hasAttribute('inert'), true);
    assert.equal(f.header.hasAttribute('inert'), true);
    f.press('Directions'); f.flush(); f.press(`Back to ${apollo.name}`); f.flush();
    assert.ok(f.document.activeElement === f.title(), 'Back must focus the restored heading while the sheet remains modal');
    assert.equal(f.map.hasAttribute('inert'), true);
    for (const event of [
      { key: 'Escape', defaultPrevented: true }, { key: 'Escape', isComposing: true },
      { key: 'Escape', target: f.searchField }, { key: 'Enter' },
    ]) f.key(event);
    f.flush(); assert.ok(f.title());
    f.key({ key: 'Escape', target: f.title()! }); f.flush();
    assert.equal(f.browser.location.searchParams.get('place'), null);
    assert.equal(f.browser.location.searchParams.get('q'), 'jazz');
    assert.equal(f.map.hasAttribute('inert'), false);
    assert.equal(f.header.hasAttribute('inert'), false);
    assert.equal(f.preservedInert.hasAttribute('inert'), true);
    assert.equal(f.document.activeElement, f.openers.get(apollo.id));
    f.browser.history.forward(); f.flush();
    assert.equal(f.document.activeElement, f.title());
    f.unmount();
    assert.equal(f.map.hasAttribute('inert'), false);
    assert.equal(f.preservedInert.hasAttribute('inert'), true);
  });
});
