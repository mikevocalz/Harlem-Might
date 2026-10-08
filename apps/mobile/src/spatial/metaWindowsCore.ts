import { createElement, Fragment, type ComponentType, type ReactElement, type ReactNode } from 'react';
import type { MetaWindowPlacement, MetaWindowProps } from '@viro-external/meta-layout';

/**
 * The parts of `@metavr/layout-compat` and `@metavr/layout-window-compat`
 * 1.0.0 this app uses. Typed here so this file never imports the SDK: Meta's
 * `.d.ts` files are Flow-generated and type `children` as Flow's `Node`.
 */
export type MetaLayoutModules = {
  layout: {
    SpatialSceneProvider: ComponentType<{ initializer?: unknown; children?: ReactNode }>;
    useSpatialScene: () => { isSpatialAvailable: boolean };
  };
  window: {
    SpatialWindow: ComponentType<MetaWindowProps & { children?: ReactNode }>;
    createWindowScene: (options?: { fallback?: 'inline' | 'drop' }) => unknown;
    useSpatialWindowState: (label?: string) => { placement: MetaWindowPlacement };
  };
  /**
   * Wraps every window's content. On Android it gives the promoted window the
   * activity's view-tree owners, without which Compose views (`@expo/ui`)
   * throw on attach. See `modules/spatial-window-owners`.
   */
  windowOwners: ComponentType<{ style?: { flex: number }; children?: ReactNode }>;
};

const FILL = { flex: 1 } as const;

/**
 * The app's Meta window facade. Built once by {@linkcode createMetaWindows}.
 */
export type MetaWindows = {
  /** True when the SDK loaded. False on PICO, phone, iOS, web and in tests. */
  readonly linked: boolean;
  /** Wraps the app once. A fragment when the SDK is not linked. */
  SceneProvider: (props: { children?: ReactNode }) => ReactElement;
  /**
   * `<SpatialWindow>` with the props spread through unchanged and the content
   * wrapped in {@linkcode MetaLayoutModules.windowOwners}. When the SDK
   * is not linked, the children render where the element is declared, which
   * is what Meta's `fallback="inline"` does too.
   */
  Window: (props: { window: MetaWindowProps; children?: ReactNode }) => ReactElement;
  /** `useSpatialWindowState(label).placement`; always `inline` when not linked. */
  usePlacement: (label: string) => MetaWindowPlacement;
  /** `useSpatialScene().isSpatialAvailable`; always false when not linked. */
  useSpatialAvailable: () => boolean;
};

const useInline = (): MetaWindowPlacement => 'inline';
const useUnavailable = (): boolean => false;

/**
 * Builds the facade. `enabled` is `isHorizonBuild`; when false, `load` never
 * runs. A load failure on a quest build logs and falls back to inline, so the
 * main window keeps working with zero promoted windows.
 *
 * Hooks are chosen once from the load result, so no component switches hook
 * implementations between renders.
 */
export function createMetaWindows(enabled: boolean, load: () => MetaLayoutModules): MetaWindows {
  let modules: MetaLayoutModules | undefined;
  if (enabled) {
    try {
      modules = load();
    } catch (error) {
      console.warn(`[metaWindows] Meta VR Layout SDK failed to load: ${String(error)}`);
    }
  }

  if (!modules) {
    return {
      linked: false,
      SceneProvider: ({ children }) => createElement(Fragment, null, children),
      Window: ({ children }) => createElement(Fragment, null, children),
      usePlacement: useInline,
      useSpatialAvailable: useUnavailable,
    };
  }

  const { layout, window, windowOwners } = modules;
  // Meta's provider refuses configless initialization and throws if the
  // initializer type changes after mount, so build exactly one per app.
  const initializer = window.createWindowScene({ fallback: 'inline' });

  return {
    linked: true,
    SceneProvider: ({ children }) =>
      createElement(layout.SpatialSceneProvider, { initializer }, children),
    Window: ({ window: props, children }) =>
      createElement(window.SpatialWindow, props, createElement(windowOwners, { style: FILL }, children)),
    usePlacement: (label) => window.useSpatialWindowState(label).placement,
    useSpatialAvailable: () => layout.useSpatialScene().isSpatialAvailable,
  };
}
