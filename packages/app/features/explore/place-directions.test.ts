import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import type { PlaceRecord } from '../../content/records.ts';
import { verifiedDestination } from '../journey/model.ts';
import type { RouteRequest } from '../navigation/model/route.ts';
import { RouteProviderError } from '../navigation/providers/routeProvider.ts';
import { resetNavigationStores } from '../navigation/session/navigationStore.ts';
import { useNavigationUi } from '../navigation/view/navigationUi.store.ts';
import * as runtime from '../navigation/view/runtime.ts';
import { getCataloguePlace, placeCatalogueStore } from './place-catalogue.store.ts';

const initialCatalogue = placeCatalogueStore.getState();
afterEach(() => {
  placeCatalogueStore.setState(initialCatalogue);
  runtime.resetNavigationRuntimeForTests();
  resetNavigationStores();
  useNavigationUi.getState().resetTrip();
});

/** Real panel request effect and navigation runtime; only view/native leaves are inert. */
function renderDirections(placeId: string) {
  const effects: (() => void)[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: { useEffect: (callback: () => void) => effects.push(callback) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@acme/ui/mights': { MightsButton: 'button', MightsHeading: 'heading', MightsText: 'text' },
    '@acme/ui/tw': { Pressable: 'pressable', ScrollView: 'scroll', Text: 'text', View: 'view' },
    '../../explore/explore-type': { useExploreType: () => ({ buttons: {} }) },
    '../view/directionsView': {},
    '../view/navigationUi.store': {
      useNavigationUi: (selector: (state: ReturnType<typeof useNavigationUi.getState>) => unknown) =>
        selector(useNavigationUi.getState()),
    },
    '../view/runtime': runtime,
    './hooks': { useDirectionsView: () => ({ kind: 'default' }), useHasDevicePosition: () => false },
    './ManeuverIcon': { ManeuverIcon: 'icon' },
  };
  const compiled = transpileModule(readFileSync(new URL('../navigation/ui/DirectionsPanel.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
  }).outputText;
  const exports: { DirectionsPanel?: (props: unknown) => unknown } = {};
  new Function('require', 'exports', compiled)((id: string) => {
    assert.ok(id in modules, `Unexpected directions import ${id}`);
    return modules[id];
  }, exports);
  // This is the native Explore layout's handoff: the common lookup supplies
  // the destination and its subscribed catalogue supplies manual origins.
  exports.DirectionsPanel!({ place: getCataloguePlace(placeId), originPlaces: placeCatalogueStore.getState().places });
  effects.forEach((effect) => effect());
}

for (const location of [[-73.94, 40.81] as [number, number], undefined]) {
  test(`directions requests the detail-verified coordinate after ${location ? 'a correction' : 'a location is added'}`, async () => {
    const old: PlaceRecord = {
      id: 1, slug: 'destination', name: 'Old destination', kind: 'business', lifecycle: 'open',
      location, locationAccuracy: 'approx', featured: false, images: [],
    };
    const corrected: PlaceRecord = {
      ...old, name: 'Verified destination', location: [-73.955, 40.815], locationAccuracy: 'verified',
      locationSourceUrl: 'https://example.com/destination', locationSourceReadAt: new Date(Date.now() - 1000).toISOString(),
    };
    const origin: PlaceRecord = { ...old, id: 2, slug: 'origin', name: 'Origin', location: [-73.96, 40.82] };
    const store = placeCatalogueStore.getState();
    store.connect({
      listExploreCatalogue: async () => ({ status: 'ok', data: [old, origin] }),
      getPlace: async () => ({ status: 'ok', data: corrected }),
    });
    await store.refresh();
    await store.loadPlace('destination');
    const verified = verifiedDestination(corrected);
    assert.ok(verified, 'The detail CTA must be enabled by this record');
    const requests: RouteRequest[] = [];
    runtime.configureNavigationRuntime({ provider: {
      id: 'mapbox', supportedModes: ['walking'],
      async getRoutes(request) {
        requests.push(request);
        throw new RouteProviderError('no-route', 'mapbox', 'Fixture stops after observing the destination');
      },
    } });
    useNavigationUi.getState().setOriginChoice({ kind: 'place', placeId: 'origin' });
    renderDirections('destination');
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0]?.destination, verified);
    assert.deepEqual(requests[0]?.origin, { longitude: -73.96, latitude: 40.82 });
  });
}
