'use client';

import { useCallback, useState, type ComponentType } from 'react';
import { Pressable, Text, View } from '@acme/ui/tw';
import {
  isMetaHorizonXR,
  isPico,
  isStudioApiError,
  StudioSceneNavigator,
  Viro3DSceneNavigator,
  ViroXRSceneNavigator,
} from './viro';
import { studioSceneId, type StudioSceneKey } from './studio';

type HeadsetNavigatorProps = {
  initialScene?: { scene: ComponentType<any> };
  arInitialScene?: { scene: ComponentType<any> };
  vrInitialScene?: { scene: ComponentType<any> };
  vrModeEnabled?: boolean;
  passthroughEnabled?: boolean;
  handTrackingEnabled?: boolean;
  trackingOrigin?: 'eye' | 'floor';
  provider?: 'reactvision' | 'arcore' | 'none';
  onExitViro?: () => void;
  style?: Record<string, unknown>;
};

const HeadsetNavigator =
  ViroXRSceneNavigator as unknown as ComponentType<HeadsetNavigatorProps>;

function studioErrorDetail(error: Error): string {
  // Branch on code, never message — StudioApiError's docs warn the message is
  // stable by design while a transport failure localises on iOS.
  if (isStudioApiError(error)) {
    if (error.code === 'SCENE_NOT_FOUND') return 'That scene is not in the project yet.';
    if (error.code === 'UNAUTHORIZED') return 'The build was made without a working project key.';
    return error.detail ?? error.message;
  }
  return error.message;
}

function StudioStatus({
  title,
  detail,
  onRetry,
  onLocal,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
  onLocal?: () => void;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center gap-4 bg-black/85 px-8">
      <Text className="text-center text-sm font-bold uppercase tracking-[0.18em] text-cyan-100">
        {title}
      </Text>
      {detail ? <Text className="text-center text-xs text-white/55">{detail}</Text> : null}
      <View className="flex-row gap-3">
        {onRetry ? (
          <Pressable className="border border-cyan-300/60 px-4 py-2" onPress={onRetry}>
            <Text className="text-xs uppercase tracking-[0.12em] text-cyan-200">Try again</Text>
          </Pressable>
        ) : null}
        {onLocal ? (
          <Pressable className="border border-white/25 px-4 py-2" onPress={onLocal}>
            <Text className="text-xs uppercase tracking-[0.12em] text-white/70">Local scene</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One mount point for a scene that may be Studio-authored or code-first.
 *
 * `scene` is a registry key: when `STUDIO_SCENES` maps it to a Studio scene id
 * and the build carries Studio credentials, this renders
 * `StudioSceneNavigator`; otherwise — and on any scene-load failure the viewer
 * chooses to recover from — it renders `fallback` through the same navigator
 * routing `SpatialViroExperience` uses. Screens name the scene they want, not
 * how Studio is configured.
 */
export function StudioExperience({
  scene,
  fallback: LocalScene,
  passthrough = false,
  onExitViro,
}: {
  scene: StudioSceneKey;
  fallback: ComponentType;
  /** Local-path passthrough; the colocation path passes true on Horizon OS. */
  passthrough?: boolean;
  onExitViro?: () => void;
}) {
  const [useLocal, setUseLocal] = useState(false);
  const sceneId = useLocal ? null : studioSceneId(scene);
  const fallbackToLocal = useCallback(() => setUseLocal(true), []);

  if (sceneId) {
    return (
      <View className="relative flex-1">
        <StudioSceneNavigator
          sceneId={sceneId}
          onExitViro={onExitViro}
          loadingView={<StudioStatus title="Loading Studio scene…" />}
          renderError={(error, retry) => (
            <StudioStatus
              title="Studio scene failed to load"
              detail={studioErrorDetail(error)}
              onRetry={retry}
              onLocal={fallbackToLocal}
            />
          )}
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  if (isMetaHorizonXR || isPico) {
    return (
      <HeadsetNavigator
        initialScene={{ scene: LocalScene }}
        vrInitialScene={{ scene: LocalScene }}
        vrModeEnabled
        passthroughEnabled={passthrough}
        handTrackingEnabled
        trackingOrigin="floor"
        onExitViro={onExitViro}
        style={{ flex: 1 }}
      />
    );
  }

  return (
    <View className="relative flex-1">
      <Viro3DSceneNavigator
        initialScene={{ scene: LocalScene as never }}
        onExitViro={onExitViro}
        // Navigator host props are a style object, not a className target.
        style={{ flex: 1 }}
      />
    </View>
  );
}
