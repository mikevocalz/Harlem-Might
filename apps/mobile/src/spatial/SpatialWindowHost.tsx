import { View } from '@acme/ui/tw';
import { metaWindows } from './metaWindows';
import { useSpatialWindowHostStore } from './spatialWindowHost.store';

/**
 * Renders every hosted `<SpatialWindow>` at the main surface's origin
 * (DECISIONS S18, ADR 0005). Mount it once, as a direct child of the app
 * root, inside `metaWindows.SceneProvider`.
 *
 * Why the origin: Meta's `SpatialWindowRootViewGroup` dispatches touches
 * with `pageX/pageY` relative to the promoted window, while RN's
 * Pressability measures the pressed view in the main surface. Content
 * declared deep in a layout sits hundreds of dp from the origin, so the
 * first MOVE of a controller ray or a pinch reads as leaving the press
 * rectangle and cancels the press. Hosted at (0,0), a view's main-surface
 * position equals its position inside the window, and presses complete.
 *
 * Windows render with `fallback: 'drop'`, so nothing ever draws inline at
 * the origin. A surface whose window is dropped renders its own in-window
 * fallback (see `useHostedSpatialWindow`). Renders nothing where the Meta
 * SDK is not linked.
 */
export function SpatialWindowHost() {
  const windows = useSpatialWindowHostStore((state) => state.windows);
  if (!metaWindows.linked) return null;
  return (
    <View className="absolute left-0 top-0 h-0 w-0" pointerEvents="box-none">
      {Object.values(windows).map(({ window, content }) => (
        <metaWindows.Window key={window.label} window={{ ...window, fallback: 'drop' }}>
          {content}
        </metaWindows.Window>
      ))}
    </View>
  );
}
