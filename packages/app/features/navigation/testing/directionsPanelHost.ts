// Test-only mounted hook host. Executes the production panel, view model,
// runtime and stores without rendering native leaves or requesting location.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import type { DirectionsPanelProps } from '../ui/DirectionsPanel.tsx';
import type { DirectionsPlace } from '../ui/hooks.ts';
import { navigationFixStore, useNavigationStore } from '../session/navigationStore.ts';
import { directionsView } from '../view/directionsView.ts';
import { useNavigationUi } from '../view/navigationUi.store.ts';
import * as runtime from '../view/runtime.ts';
import { flush } from './manualClock.ts';

const compiled = transpileModule(readFileSync(new URL('../ui/DirectionsPanel.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
}).outputText;
const coordinate = (place?: DirectionsPlace) => place?.lngLat
  ? { longitude: place.lngLat[0], latitude: place.lngLat[1] }
  : undefined;

type Effect = { deps: readonly unknown[]; cleanup?: (() => void) | void };

/**
 * Keeps hook slots across renders and compares dependencies with Object.is,
 * including cleanup-before-replacement. Store writes schedule another render;
 * the bound catches feedback loops rather than silently accepting reroutes.
 * This is not React renderer or device/browser validation.
 */
export function createDirectionsPanelHost() {
  const effects: Effect[] = [];
  let cursor = 0;
  let scheduled: (() => void)[] = [];
  let props: DirectionsPanelProps | undefined;
  let dirty = false;
  const useEffect = (setup: () => void | (() => void), deps: readonly unknown[]) => {
    const index = cursor++;
    const previous = effects[index];
    if (!previous || deps.length !== previous.deps.length || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      scheduled.push(() => {
        previous?.cleanup?.();
        const effect: Effect = { deps };
        effects[index] = effect;
        effect.cleanup = setup();
      });
    }
  };
  const jsx = (type: unknown, childProps: unknown) => ({ type, props: childProps });
  const modules: Record<string, unknown> = {
    react: { useEffect },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@acme/ui/mights': { MightsButton: 'button', MightsHeading: 'heading', MightsText: 'text' },
    '@acme/ui/tw': { Pressable: 'pressable', ScrollView: 'scroll', Text: 'text', View: 'view' },
    '../../explore/explore-type': { useExploreType: () => ({ buttons: {} }) },
    '../view/directionsView': {},
    '../view/navigationUi.store': {
      useNavigationUi: (selector: (state: ReturnType<typeof useNavigationUi.getState>) => unknown) => selector(useNavigationUi.getState()),
    },
    '../view/runtime': runtime,
    './hooks': {
      useHasDevicePosition: () => runtime.devicePositionForPlanning(navigationFixStore.getState()) !== undefined,
      useDirectionsView: (place: DirectionsPlace, originPlace?: DirectionsPlace) => {
        const ui = useNavigationUi.getState();
        return directionsView(useNavigationStore.getState(), {
          place: { id: place.id, name: place.name, coordinate: coordinate(place), street: place.street },
          mode: ui.mode, originChoice: ui.originChoice, location: ui.location, online: ui.online,
          devicePosition: runtime.devicePositionForPlanning(navigationFixStore.getState()),
          originPlaceName: originPlace?.name, now: Date.now(),
        }, coordinate(originPlace));
      },
    },
    './ManeuverIcon': { ManeuverIcon: 'icon' },
  };
  const exports: { DirectionsPanel?: (props: DirectionsPanelProps) => unknown } = {};
  new Function('require', 'exports', compiled)((id: string) => {
    assert.ok(id in modules, `Unexpected directions import ${id}`);
    return modules[id];
  }, exports);
  const subscriptions = [useNavigationUi, useNavigationStore, navigationFixStore].map((store) => store.subscribe(() => { dirty = true; }));
  function reconcile() {
    for (let renders = 0; dirty; renders++) {
      assert.ok(renders < 20, 'DirectionsPanel must settle without a render/request loop');
      dirty = false;
      cursor = 0;
      scheduled = [];
      if (props) exports.DirectionsPanel!(props);
      scheduled.forEach((setup) => setup());
    }
  }
  return {
    render(next: DirectionsPanelProps) {
      props = next;
      dirty = true;
      reconcile();
    },
    async settle() {
      await flush();
      reconcile();
      await flush();
      reconcile();
    },
    unmount() {
      props = undefined;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      effects.forEach((effect) => effect.cleanup?.());
    },
  };
}
