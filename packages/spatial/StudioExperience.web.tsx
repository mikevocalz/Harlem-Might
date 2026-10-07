'use client';

import { useCallback, useState, type ComponentType } from 'react';
import { Pressable, Text, View } from '@acme/ui/tw';
import { StudioSceneNavigator, Viro3DSceneNavigator } from './viro';
import type { StudioSceneResponse } from './viro';
/* `tsc` resolves `./viro` to the native barrel — the web navigator's own
   props live on its `.web` module, which is also why this file names them
   through the deep specifier instead of the barrel type export. */
import type { StudioSceneNavigatorWebProps } from '@reactvision/react-viro/dist/components/Studio/StudioSceneNavigator.web';
import {
  STUDIO_ENDPOINT,
  studioRequestHeaders,
  studioSceneId,
  type StudioSceneKey,
} from './studio';

type WebNavigatorProps = {
  initialScene: { scene: ComponentType<any> };
  webRendererOptions: { assetBaseUrl: string };
  showReticle?: boolean;
  style?: Record<string, unknown>;
};

const WebViro3DSceneNavigator =
  Viro3DSceneNavigator as unknown as ComponentType<WebNavigatorProps>;

const WebStudioSceneNavigator =
  StudioSceneNavigator as unknown as ComponentType<StudioSceneNavigatorWebProps>;

function StudioStatus({
  title,
  detail,
  onLocal,
}: {
  title: string;
  detail?: string;
  onLocal?: () => void;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center gap-4 bg-black/85 px-8">
      <Text className="text-center text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">
        {title}
      </Text>
      {detail ? <Text className="text-center text-xs text-white/55">{detail}</Text> : null}
      {onLocal ? (
        <Pressable className="border border-white/25 px-4 py-2" onPress={onLocal}>
          <Text className="text-xs uppercase tracking-[0.12em] text-white/70">Local scene</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Web half of `StudioExperience`. There is no manifest on web, so the scene
 * fetch is the platform REST call with the public `x-api-key` — the contract
 * `VRTStudioModule` implements natively.
 */
export function StudioExperience({
  scene,
  fallback: LocalScene,
}: {
  scene: StudioSceneKey;
  fallback: ComponentType;
  passthrough?: boolean;
  onExitViro?: () => void;
}) {
  const [useLocal, setUseLocal] = useState(false);
  const sceneId = useLocal ? null : studioSceneId(scene);
  const fallbackToLocal = useCallback(() => setUseLocal(true), []);

  const loadScene = useCallback(
    async (id: string): Promise<StudioSceneResponse> => {
      const response = await fetch(`${STUDIO_ENDPOINT}/functions/v1/scenes/${id}`, {
        headers: studioRequestHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Studio scene fetch failed with HTTP ${response.status}`);
      }
      return (await response.json()) as StudioSceneResponse;
    },
    [],
  );

  if (sceneId) {
    return (
      <View className="relative flex-1">
        <WebStudioSceneNavigator
          sceneId={sceneId}
          loadScene={loadScene}
          webRendererOptions={{ assetBaseUrl: '/viro/wasm/' }}
          loadingView={<StudioStatus title="Loading Studio scene…" />}
          renderError={(error) => (
            <StudioStatus
              title="Studio scene failed to load"
              detail={error.message}
              onLocal={fallbackToLocal}
            />
          )}
        />
      </View>
    );
  }

  return (
    <View className="relative flex-1">
      <WebViro3DSceneNavigator
        initialScene={{ scene: LocalScene }}
        webRendererOptions={{ assetBaseUrl: '/viro/wasm/' }}
        showReticle={false}
        // Navigator host props are a style object, not a className target.
        style={{ flex: 1 }}
      />
    </View>
  );
}
