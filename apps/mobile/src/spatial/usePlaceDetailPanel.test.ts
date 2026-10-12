import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, it } from 'node:test';
import { ModuleKind, transpileModule } from 'typescript';
import * as panel from './placeDetailPanel.ts';
import { usePlaceDetailPanelStore } from './placeDetailPanel.store.ts';
import { useExplore } from '../../../../packages/app/features/explore/explore.store.ts';

type Effect = { deps?: unknown[]; setup: () => (() => void) | undefined; cleanup?: () => void };
type OpenedEvent = { name: string };
type ClosedEvent = { name: string; reason: 'app' | 'user' };
type PlaceRoute = { key: string; params: { placeId?: string | string[] } };

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// Execute the production hook and runtime with real Zustand stores. Only
// React's effect scheduler and the native bridge are faked. Events go to the
// currently registered listeners, never saved/removed callbacks. No device claim.
function panelFixture(isAvailable = true, replayEffects = false, isHorizonBuild = true) {
  usePlaceDetailPanelStore.setState({ status: 'closed' });
  useExplore.setState(useExplore.getInitialState());
  let effects: Effect[] = [];
  let refs: { current: unknown }[] = [];
  const opens: ReturnType<typeof deferred>[] = [];
  const closes: ReturnType<typeof deferred>[] = [];
  const warnings: string[] = [];
  const openedListeners = new Set<(event: OpenedEvent) => void>();
  const closedListeners = new Set<(event: ClosedEvent) => void>();
  let closedByUser = 0;
  let effectIndex = 0;
  let refIndex = 0;
  let pending: (() => void)[] = [];
  let dirty = true;
  let replayNextCommit = replayEffects;
  let mounted = true;
  let placement: unknown;
  let onClosedByUser = () => { closedByUser += 1; useExplore.getState().closePlace(); };
  const subscriptions = [
    usePlaceDetailPanelStore.subscribe(() => { dirty = true; }),
    useExplore.subscribe(() => { dirty = true; }),
  ];
  let selectionSubscriptions = 0;
  const modules: Record<string, unknown> = {
    react: {
      useEffect: (callback: () => (() => void) | undefined, deps?: unknown[]) => {
        const index = effectIndex++;
        const previous = effects[index];
        if (previous?.deps && deps && previous.deps.length === deps.length
          && deps.every((dep, i) => Object.is(dep, previous.deps![i]))) return;
        pending.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, setup: callback, cleanup: callback() };
        });
      },
      useRef: (value: unknown) => refs[refIndex++] ??= { current: value },
    },
    '@acme/app': { useExplore: {
      getState: useExplore.getState,
      subscribe: (callback: Parameters<typeof useExplore.subscribe>[0]) => {
        selectionSubscriptions += 1;
        const unsubscribe = useExplore.subscribe(callback);
        return () => { selectionSubscriptions -= 1; unsubscribe(); };
      },
    } },
    '../../modules/spatial-panels': {
      spatialPanels: {
        isAvailable,
        openPanel: (name: string) => {
          assert.equal(name, panel.PLACE_DETAIL_PANEL);
          const request = deferred();
          opens.push(request);
          return request.promise;
        },
        closePanel: (name: string) => {
          assert.equal(name, panel.PLACE_DETAIL_PANEL);
          const request = deferred();
          closes.push(request);
          return request.promise;
        },
        addOnPanelOpenedListener: (callback: (event: OpenedEvent) => void) => {
          openedListeners.add(callback);
          return { remove: () => { openedListeners.delete(callback); } };
        },
        addOnPanelClosedListener: (callback: (event: ClosedEvent) => void) => {
          closedListeners.add(callback);
          return { remove: () => { closedListeners.delete(callback); } };
        },
      },
    },
    './horizonBuild': { isHorizonBuild },
    './placeDetailPanel': panel,
    './placeDetailPanel.store': {
      usePlaceDetailPanelStore: Object.assign((
        selector: (state: ReturnType<typeof usePlaceDetailPanelStore.getState>) => unknown,
      ) => selector(usePlaceDetailPanelStore.getState()), {
        getState: usePlaceDetailPanelStore.getState,
      }),
    },
  };
  function loadProductionModule(file: string, overrides: Record<string, unknown> = {}) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const compiled = transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS },
    }).outputText;
    const exports: Record<string, unknown> = {};
    new Function('require', 'exports', 'console', compiled)((id: string) => {
      if (id in overrides) return overrides[id];
      assert.ok(id in modules, `Unexpected panel runtime import ${id}`);
      return modules[id];
    }, exports, { warn: (message: string) => { warnings.push(message); } });
    return exports;
  }
  modules['../navigation/explorePlaceRoute'] = loadProductionModule('../navigation/explorePlaceRoute.ts');
  modules['../../../src/navigation/explorePlaceRoute'] = modules['../navigation/explorePlaceRoute'];
  modules['./placeDetailPanelRuntime'] = loadProductionModule('./placeDetailPanelRuntime.ts');
  const { usePlaceDetailPanel: runPanelHook } = loadProductionModule('./usePlaceDetailPanel.ts') as {
    usePlaceDetailPanel: (input: { selectedPlaceId: string | null; onClosedByUser: () => void }) => unknown;
  };
  assert.equal(openedListeners.size, 0, 'Importing the runtime must not subscribe to native events');
  assert.equal(closedListeners.size, 0);
  assert.equal(selectionSubscriptions, 0);

  function render() {
    assert.ok(mounted);
    let renders = 0;
    do {
      assert.ok(++renders < 20, 'Panel effects must settle without a retry loop');
      dirty = false;
      effectIndex = refIndex = 0;
      pending = [];
      placement = runPanelHook({ selectedPlaceId: useExplore.getState().selectedPlaceId, onClosedByUser });
      pending.forEach((effect) => effect());
      if (replayNextCommit) {
        // StrictMode replays setup/cleanup before committing the next render,
        // so these are the same closures, including the original selection and status.
        replayNextCommit = false;
        effects.forEach((effect) => effect.cleanup?.());
        effects.forEach((effect) => { effect.cleanup = effect.setup(); });
      }
    } while (dirty);
    return placement;
  }
  return {
    opens, closes, warnings, openedListeners, closedListeners,
    route(entry: PlaceRoute) {
      // Execute the actual child route's mount effects before the parent's
      // remount effects, matching React's child-first passive effect order.
      const childEffects: (() => void)[] = [];
      const child = loadProductionModule('../../app/(tabs)/explore/[placeId].tsx', {
        react: { useEffect: (callback: () => void) => childEffects.push(callback) },
        'solito/navigation': { useParams: () => entry.params },
        'expo-router/react-navigation': { useRoute: () => entry },
      }) as { default: () => null };
      child.default();
      childEffects.forEach((effect) => effect());
      if (mounted) render();
    },
    status: () => usePlaceDetailPanelStore.getState().status,
    closedByUser: () => closedByUser,
    select(id: string | null) { useExplore.getState().selectPlace(id); return mounted ? render() : undefined; },
    setSelectionBeforeRender(id: string | null) { useExplore.getState().selectPlace(id); },
    selection: () => useExplore.getState().selectedPlaceId,
    selectionSubscriptions: () => selectionSubscriptions,
    setOnClosedByUser(callback: () => void) { onClosedByUser = callback; if (mounted) render(); },
    opened(name = panel.PLACE_DETAIL_PANEL) {
      [...openedListeners].forEach((listener) => listener({ name }));
      if (mounted) render();
    },
    closed(reason: ClosedEvent['reason'] = 'app', name = panel.PLACE_DETAIL_PANEL) {
      [...closedListeners].forEach((listener) => listener({ name, reason }));
      if (mounted) render();
    },
    async settle() {
      // Let rejected bridge promises reach their real production catch handlers.
      // node:test also fails this test if a rejection escapes unhandled.
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (mounted && dirty) render();
    },
    remount() {
      assert.equal(mounted, false);
      effects = [];
      refs = [];
      replayNextCommit = replayEffects;
      mounted = true;
      return render();
    },
    replaceOwnerBeforeCleanup(callback: () => void) {
      const previous = effects;
      effects = [];
      refs = [];
      onClosedByUser = callback;
      render();
      return () => previous.forEach((effect) => effect.cleanup?.());
    },
    dispose() {
      // End this test's native session through actual store/event contracts.
      // This is fixture teardown, not an exported production reset shortcut.
      useExplore.getState().selectPlace('teardown');
      useExplore.getState().closePlace();
      [...closedListeners].forEach((listener) => listener({ name: panel.PLACE_DETAIL_PANEL, reason: 'app' }));
      effects.forEach((effect) => effect.cleanup?.());
      subscriptions.forEach((unsubscribe) => unsubscribe());
      assert.equal(openedListeners.size, 0);
      assert.equal(closedListeners.size, 0);
      assert.equal(selectionSubscriptions, 0);
    },
    unmount() {
      if (!mounted) return;
      mounted = false;
      effects.forEach((effect) => effect.cleanup?.());
    },
  };
}

const fixtures: ReturnType<typeof panelFixture>[] = [];
function fixture(isAvailable = true, replayEffects = false, isHorizonBuild = true) {
  const value = panelFixture(isAvailable, replayEffects, isHorizonBuild);
  fixtures.push(value);
  return value;
}

afterEach(() => {
  fixtures.splice(0).forEach((value) => value.dispose());
  usePlaceDetailPanelStore.setState({ status: 'closed' });
});

it('closes again after a selection cleared during opening, then waits for native closure', async () => {
  const value = fixture();
  assert.equal(value.select('apollo'), 'spatial');
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 1);
  value.select(null);
  assert.equal(value.closes.length, 1);
  value.closes[0].resolve(); // There was no activity to close yet.
  await value.settle();
  value.opened();
  assert.equal(value.status(), 'open');
  assert.equal(value.closes.length, 2);
  value.closes[1].resolve();
  await value.settle();
  assert.equal(value.status(), 'open', 'Resolving close is not a native closed event');
  value.closed();
  assert.equal(value.status(), 'closed');
  assert.equal(value.closedByUser(), 0);
});

it('catches a clear-during-open close failure and reuses the open panel before retrying close', async () => {
  const value = fixture();
  value.select('apollo');
  value.select(null);
  value.closes[0].resolve();
  await value.settle();
  value.opened();
  value.closes[1].reject(new Error('close after opening failed'));
  await value.settle();
  assert.equal(value.warnings.length, 1);
  assert.match(value.warnings[0], /Place Detail panel did not close/);
  assert.equal(value.status(), 'open');
  assert.equal(value.closes.length, 2, 'A failure must not trigger an automatic retry loop');
  assert.equal(value.select('schomburg'), 'spatial');
  assert.equal(value.opens.length, 1, 'The existing panel must be reused');
  value.select(null);
  assert.equal(value.closes.length, 3);
  value.closes[2].resolve();
  value.closed();
  assert.equal(value.select('apollo'), 'spatial');
  assert.equal(value.opens.length, 2);
  value.opened();
  assert.equal(value.status(), 'open');
});

it('uses the same recovery for an ordinary close failure without hiding the native panel', async () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.select(null);
  value.closes[0].reject(new Error('ordinary close failed'));
  await value.settle();
  assert.equal(value.status(), 'open');
  value.select('schomburg');
  value.select(null);
  assert.equal(value.closes.length, 2);
  value.closed();
  value.closes[1].reject(new Error('failure delivered after native closure'));
  await value.settle();
  assert.equal(value.status(), 'closed');
});

it('deduplicates the opened listener and selection effect when the selection changes before render', () => {
  const value = fixture();
  value.select('apollo');
  value.setSelectionBeforeRender(null);
  value.opened();
  assert.equal(value.status(), 'open');
  assert.equal(value.closes.length, 1);
});

it('does not let a late launch failure replace an authoritative opened event', async () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.opens[0].reject(new Error('old launch failure'));
  await value.settle();
  assert.equal(value.status(), 'open');
  assert.deepEqual(value.warnings, []);
});

it('does not let an earlier launch failure replace a new launch after native closure', async () => {
  const value = fixture();
  value.select('apollo');
  value.select(null);
  value.closed();
  value.select('schomburg');
  assert.equal(value.opens.length, 2);
  value.opens[0].reject(new Error('superseded launch failure'));
  await value.settle();
  assert.equal(value.status(), 'opening');
  value.opened();
  value.opens[1].resolve();
  await value.settle();
  assert.equal(value.status(), 'open');
});

it('keeps failed launches inline until selection clears, then permits a new launch', async () => {
  const value = fixture();
  value.select('apollo');
  value.opens[0].reject(new Error('launch failed'));
  await value.settle();
  assert.equal(value.status(), 'failed');
  assert.equal(value.select('apollo'), 'inline');
  assert.equal(value.opens.length, 1);
  assert.equal(value.select(null), 'inline');
  assert.equal(value.status(), 'closed');
  value.select('schomburg');
  assert.equal(value.opens.length, 2);
});

it('keeps native events across mounts and ignores late launch failure after opening', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  assert.equal(value.openedListeners.size, 1, 'The session, not the unmounted UI, owns native events');
  assert.equal(value.closedListeners.size, 1);
  value.opened();
  assert.equal(value.status(), 'open');
  value.remount();
  assert.equal(value.opens.length, 1, 'A remount inherits the observed native panel');
  value.opens[0].reject(new Error('launch failure after the native opened event'));
  await value.settle();
  assert.equal(value.status(), 'open');
  assert.equal(value.closedByUser(), 0);
  assert.equal(value.closes.length, 0);
  assert.deepEqual(value.warnings, []);
});

it('settles a pending launch failure across unmount/remount instead of stranding opening', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.remount();
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 1);
  value.opens[0].reject(new Error('inherited launch failed without any native event'));
  await value.settle();
  assert.equal(value.status(), 'failed');
  assert.equal(value.select('apollo'), 'inline');
  value.select(null);
  assert.equal(value.status(), 'closed');
  value.select('schomburg');
  assert.equal(value.opens.length, 2);
});

it('records a launch failure while unmounted so a later mount has the inline fallback', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.opens[0].reject(new Error('launch failed before remount'));
  await value.settle();
  assert.equal(value.status(), 'failed');
  assert.equal(value.remount(), 'inline');
  assert.equal(value.opens.length, 1);
});

it('handles a pending close rejection after unmount without changing the remounted launch', async () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.select(null);
  value.unmount();
  value.remount();
  value.closed();
  value.select('schomburg');
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 2);
  value.closes[0].reject(new Error('unmounted close failure'));
  await value.settle();
  assert.deepEqual(value.warnings, []);
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 2);
});

it('reopens for a newer selection when an earlier app close finishes', async () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.select(null);
  value.select('schomburg');
  assert.equal(value.opens.length, 1);
  value.closed();
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 2);
  value.closes[0].reject(new Error('late close failure after replacement launch'));
  await value.settle();
  assert.equal(value.status(), 'opening');
  value.opened();
  assert.equal(value.status(), 'open');
  assert.equal(value.closedByUser(), 0);
});

it('ignores unrelated panels and uses the latest user-close callback', () => {
  const value = fixture();
  value.select('apollo');
  value.opened('AnotherPanel');
  value.closed('user', 'AnotherPanel');
  assert.equal(value.status(), 'opening');
  assert.equal(value.closedByUser(), 0);
  let latestCallback = 0;
  value.setOnClosedByUser(() => { latestCallback += 1; });
  value.closed('user');
  assert.equal(latestCallback, 1);
  assert.equal(value.closedByUser(), 0);
});

it('stays inline without registering listeners or bridge calls where panels are unavailable', () => {
  const value = fixture(false);
  assert.equal(value.select('apollo'), 'inline');
  value.select(null);
  assert.equal(value.openedListeners.size, 0);
  assert.equal(value.closedListeners.size, 0);
  assert.equal(value.opens.length, 0);
  assert.equal(value.closes.length, 0);
});


it('does not launch twice when StrictMode replays effects with the same captured open command', () => {
  const value = fixture(true, true);
  value.select('apollo');
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 1);
  assert.equal(value.openedListeners.size, 1);
  assert.equal(value.closedListeners.size, 1);
  value.opened();
  value.select(null);
  value.closed();
  value.select('schomburg');
  assert.equal(value.opens.length, 2, 'A later deliberate launch still starts normally');
});

it('observes open after a successful launch promise while no UI is mounted', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.opens[0].resolve();
  await value.settle();
  assert.equal(value.status(), 'opening', 'Dispatch success must not fabricate a native opened event');
  value.opened();
  assert.equal(value.status(), 'open');
  assert.equal(value.remount(), 'spatial');
  assert.equal(value.opens.length, 1);
});

it('records open and user close during absence without calling the old layout', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.opened();
  value.closed('user');
  assert.equal(value.status(), 'closed');
  assert.equal(value.selection(), null);
  assert.equal(value.closedByUser(), 0, 'Unmounted navigation callbacks must never run');
  value.opens[0].reject(new Error('obsolete failure after native closure'));
  await value.settle();
  assert.deepEqual(value.warnings, []);
  let currentDismissals = 0;
  value.setOnClosedByUser(() => { currentDismissals += 1; });
  assert.equal(value.remount(), 'inline');
  assert.equal(currentDismissals, 1, 'The current layout performs directions, pane and route cleanup');
  assert.equal(value.opens.length, 1);
  value.select(null);
  assert.equal(currentDismissals, 1);
});

it('relaunches once on remount after a programmatic close during absence', () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.opened();
  value.closed('app');
  assert.equal(value.status(), 'closed');
  assert.equal(value.selection(), 'apollo');
  assert.equal(value.openedListeners.size, 0, 'An idle detached session releases its listeners');
  assert.equal(value.closedListeners.size, 0);
  assert.equal(value.selectionSubscriptions(), 0);
  value.remount();
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 2);
  assert.equal(value.closedByUser(), 0);
});

it('cancels a deferred dismissal when a new selection arrives before the next owner', () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.opened();
  value.closed('user');
  value.select('schomburg');
  value.remount();
  assert.equal(value.selection(), 'schomburg');
  assert.equal(value.closedByUser(), 0, 'Old user closure must not dismiss a newer selection');
  assert.equal(value.opens.length, 2);
  assert.equal(value.status(), 'opening');
});

it('cancels a deferred dismissal even when a later selection was itself cleared', () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.opened();
  value.closed('user');
  value.select('schomburg');
  value.select(null);
  value.remount();
  assert.equal(value.closedByUser(), 0);
  assert.equal(value.status(), 'closed');
  assert.equal(value.opens.length, 1);
});

it('closes a panel whose shared selection clears after the layout has unmounted', async () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.unmount();
  useExplore.getState().closePlace();
  assert.equal(value.closes.length, 1);
  value.closes[0].resolve();
  await value.settle();
  assert.equal(value.status(), 'open', 'Close dispatch success is not native closure');
  value.closed('app');
  assert.equal(value.status(), 'closed');
  assert.equal(value.remount(), 'inline');
  assert.equal(value.closedByUser(), 0);
  assert.equal(value.opens.length, 1);
});

it('retries close after open during absence when selection was cleared before the activity existed', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.select(null);
  assert.equal(value.closes.length, 1);
  value.closes[0].resolve();
  await value.settle();
  value.opened();
  assert.equal(value.closes.length, 2);
  assert.equal(value.status(), 'open');
  value.remount();
  assert.equal(value.closes.length, 2, 'Remount must inherit the pending close without dispatching duplicates');
  value.closed();
  assert.equal(value.status(), 'closed');
});

it('keeps an absent failed-close panel truthful and retries only after a new selection clears', async () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.unmount();
  value.select(null);
  value.closes[0].reject(new Error('absent close failed'));
  await value.settle();
  assert.equal(value.status(), 'open');
  assert.equal(value.warnings.length, 1);
  assert.equal(value.remount(), 'spatial');
  assert.equal(value.closes.length, 1);
  value.select('schomburg');
  value.select(null);
  assert.equal(value.closes.length, 2);
  value.closed();
  assert.equal(value.status(), 'closed');
});

it('closes on detach if selection cleared before the mounted layout could render', () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.setSelectionBeforeRender(null);
  value.unmount();
  assert.equal(value.closes.length, 1);
  value.closed();
  assert.equal(value.status(), 'closed');
});

it('forgets failed absent launches after a clear and permits the next selection', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.opens[0].reject(new Error('absent launch failed'));
  await value.settle();
  assert.equal(value.status(), 'failed');
  value.select(null);
  assert.equal(value.status(), 'closed');
  assert.equal(value.openedListeners.size, 0);
  value.select('schomburg');
  value.remount();
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 2);
});

it('does not retain an old layout callback or duplicate listeners across overlapping ownership replacement', () => {
  const value = fixture();
  value.select('apollo');
  let newOwnerDismissals = 0;
  const cleanupOldOwner = value.replaceOwnerBeforeCleanup(() => {
    newOwnerDismissals += 1;
    useExplore.getState().closePlace();
  });
  cleanupOldOwner();
  assert.equal(value.openedListeners.size, 1);
  assert.equal(value.closedListeners.size, 1);
  assert.equal(value.selectionSubscriptions(), 1);
  value.opened();
  value.closed('user');
  assert.equal(value.closedByUser(), 0);
  assert.equal(newOwnerDismissals, 1);
  assert.equal(value.selection(), null);
  assert.equal(value.status(), 'closed');
  value.unmount();
  assert.equal(value.openedListeners.size, 0);
  assert.equal(value.closedListeners.size, 0);
  assert.equal(value.selectionSubscriptions(), 0);
});

it('keeps one session through repeated active remounts and releases idle listeners', () => {
  const value = fixture(true, true);
  value.select('apollo');
  for (let cycle = 0; cycle < 5; cycle += 1) {
    value.unmount();
    value.remount();
    assert.equal(value.opens.length, 1);
    assert.equal(value.openedListeners.size, 1);
    assert.equal(value.closedListeners.size, 1);
    assert.equal(value.selectionSubscriptions(), 1);
  }
  value.opened();
  value.select(null);
  value.closed();
  for (let cycle = 0; cycle < 5; cycle += 1) {
    value.unmount();
    assert.equal(value.openedListeners.size, 0);
    assert.equal(value.closedListeners.size, 0);
    assert.equal(value.selectionSubscriptions(), 0);
    value.remount();
    assert.equal(value.openedListeners.size, 1);
    assert.equal(value.closedListeners.size, 1);
    assert.equal(value.selectionSubscriptions(), 1);
  }
});

it('delivers a deferred user dismissal once through StrictMode replay', () => {
  const value = fixture(true, true);
  value.select('apollo');
  value.unmount();
  value.opened();
  value.closed('user');
  value.remount();
  assert.equal(value.closedByUser(), 1);
  assert.equal(value.opens.length, 1);
  assert.equal(value.status(), 'closed');
});

it('stays inline outside Horizon even when the native module reports available', () => {
  const value = fixture(true, false, false);
  assert.equal(value.select('apollo'), 'inline');
  value.unmount();
  value.select(null);
  value.remount();
  assert.equal(value.openedListeners.size, 0);
  assert.equal(value.closedListeners.size, 0);
  assert.equal(value.selectionSubscriptions(), 0);
  assert.equal(value.opens.length, 0);
  assert.equal(value.closes.length, 0);
});

it('honors a native user close before opening was reported while the UI was absent', async () => {
  const value = fixture();
  value.select('apollo');
  value.unmount();
  value.closed('user');
  assert.equal(value.status(), 'closed');
  assert.equal(value.selection(), null);
  value.opens[0].resolve();
  await value.settle();
  assert.equal(value.status(), 'closed');
  assert.equal(value.remount(), 'inline');
  assert.equal(value.closedByUser(), 1);
  assert.equal(value.opens.length, 1);
});

it('releases a session once when user dismissal synchronously unmounts its current owner', () => {
  const value = fixture();
  value.select('apollo');
  value.opened();
  value.setOnClosedByUser(() => {
    useExplore.getState().closePlace();
    value.unmount();
  });
  value.closed('user');
  assert.equal(value.status(), 'closed');
  assert.equal(value.openedListeners.size, 0);
  assert.equal(value.closedListeners.size, 0);
  assert.equal(value.selectionSubscriptions(), 0);
});

it('does not restore a user-dismissed native selection when the unchanged child deep-link route remounts first', () => {
  const value = fixture();
  const route = { key: 'apollo-entry', params: { placeId: 'apollo' } };
  value.route(route);
  assert.equal(value.selection(), 'apollo');
  assert.equal(value.opens.length, 1);
  value.unmount();
  value.opened();
  value.closed('user');
  assert.equal(value.selection(), null);
  assert.equal(value.closedByUser(), 0);
  value.route(route);
  value.remount();
  assert.equal(value.selection(), null);
  assert.equal(value.status(), 'closed');
  assert.equal(value.opens.length, 1);
  assert.equal(value.closedByUser(), 1);
});

it('preserves a newer selection when a stale child deep-link mount replays before its parent', () => {
  const value = fixture();
  const route = { key: 'apollo-entry', params: { placeId: 'apollo' } };
  value.route(route);
  value.unmount();
  value.opened();
  value.closed('user');
  value.select('schomburg');
  value.route(route);
  value.remount();
  assert.equal(value.selection(), 'schomburg');
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 2);
  assert.equal(value.closedByUser(), 0);
});

it('allows an intentional same-place user reopen despite replay of the old child route', () => {
  const value = fixture();
  const route = { key: 'apollo-entry', params: { placeId: 'apollo' } };
  value.route(route);
  value.unmount();
  value.opened();
  value.closed('user');
  useExplore.getState().openPlace('apollo', 'apollo-marker');
  value.route(route);
  value.remount();
  assert.equal(value.selection(), 'apollo');
  assert.equal(useExplore.getState().sheet.returnFocusId, 'apollo-marker');
  assert.equal(value.status(), 'opening');
  assert.equal(value.opens.length, 2);
  assert.equal(value.closedByUser(), 0);
});

for (const nextRoute of [
  { label: 'a new route entry to the same place', key: 'apollo-new-entry', placeId: 'apollo' },
  { label: 'new navigation params on the same route key', key: 'apollo-entry', placeId: 'apollo' },
  { label: 'a different deep-linked place on the same route key', key: 'apollo-entry', placeId: 'schomburg' },
]) {
  it(`allows ${nextRoute.label} after an absent user close`, () => {
    const value = fixture();
    value.route({ key: 'apollo-entry', params: { placeId: 'apollo' } });
    value.unmount();
    value.opened();
    value.closed('user');
    value.route({ key: nextRoute.key, params: { placeId: nextRoute.placeId } });
    value.remount();
    assert.equal(value.selection(), nextRoute.placeId);
    assert.equal(value.status(), 'opening');
    assert.equal(value.opens.length, 2);
    assert.equal(value.closedByUser(), 0);
  });
}

it('does not reapply retained routes during repeated remounts or StrictMode dismissal replay', () => {
  const value = fixture(true, true);
  const route = { key: 'apollo-entry', params: { placeId: ['apollo'] } };
  value.route(route);
  value.route(route);
  assert.equal(value.opens.length, 1);
  value.unmount();
  value.opened();
  value.closed('user');
  for (let cycle = 0; cycle < 3; cycle += 1) {
    value.route(route);
    value.remount();
    assert.equal(value.selection(), null);
    assert.equal(value.opens.length, 1);
    assert.equal(value.closedByUser(), 1);
    value.unmount();
  }
});

it('restores a genuinely revisited earlier deep link after another route was applied', () => {
  const value = fixture(false);
  const apollo = { key: 'apollo-entry', params: { placeId: 'apollo' } };
  const schomburg = { key: 'schomburg-entry', params: { placeId: 'schomburg' } };
  value.route(apollo);
  value.route(schomburg);
  value.route(apollo);
  assert.equal(value.selection(), 'apollo');
  assert.equal(value.opens.length, 0);
});

for (const platform of [
  { label: 'unsupported panels', available: false, horizon: true },
  { label: 'non-Horizon builds', available: true, horizon: false },
  { label: 'Horizon without a native user dismissal', available: true, horizon: true },
]) {
  it(`preserves ordinary retained deep-link restoration on ${platform.label}`, () => {
    const value = fixture(platform.available, false, platform.horizon);
    const route = { key: 'apollo-entry', params: { placeId: 'apollo' } };
    value.route(route);
    value.unmount();
    value.select(null);
    value.closed('app');
    value.route(route);
    value.remount();
    assert.equal(value.selection(), 'apollo', 'Only an absent native user dismissal suppresses restoration');
    assert.equal(value.closedByUser(), 0);
  });
}
