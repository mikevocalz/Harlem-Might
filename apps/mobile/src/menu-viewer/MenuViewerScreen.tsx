'use client';

import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Heading, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { MenuContent } from './MenuContent';
import { useMenuViewerStore } from './store';

export function MenuViewerScreen() {
  const params = useLocalSearchParams<{ placeId?: string; menuId?: string }>();
  const status = useMenuViewerStore((state) => state.status);
  const place = useMenuViewerStore((state) => state.place);
  const menu = useMenuViewerStore((state) => state.menu);
  const error = useMenuViewerStore((state) => state.error);
  const load = useMenuViewerStore((state) => state.load);
  const reset = useMenuViewerStore((state) => state.reset);

  useEffect(() => {
    const placeId = Array.isArray(params.placeId) ? params.placeId[0] : params.placeId;
    const menuId = Array.isArray(params.menuId) ? params.menuId[0] : params.menuId;

    if (!placeId || !menuId) return;
    void load(placeId, menuId);
    return reset;
  }, [load, params.menuId, params.placeId, reset]);

  if (status === 'ready' && place && menu) {
    return <MenuContent place={place} menu={menu} />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="w-full max-w-lg items-center gap-3 rounded-xl border border-border bg-surface-raised p-6 shadow-card">
        <Heading level={1} size="title" className="text-center text-text">
          {status === 'error' ? 'Menu unavailable' : 'Loading menu'}
        </Heading>
        <Text className="text-center text-sm leading-6 text-text-muted">
          {status === 'error'
            ? error ?? 'This menu could not be loaded.'
            : 'Getting the latest menu record from Harlem Mights…'}
        </Text>
      </View>
    </View>
  );
}
