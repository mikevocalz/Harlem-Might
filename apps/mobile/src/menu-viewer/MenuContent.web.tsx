'use client';

import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Linking } from 'react-native';
import { X } from 'lucide-react-native';
import { SafeArea } from '@acme/ui';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';
import {
  menuImageUrls,
  menuPdfUrl,
  type MenuRecord,
  type PlaceWithMenus,
} from './types';

export function MenuContent({
  place,
  menu,
}: {
  place: PlaceWithMenus;
  menu: MenuRecord;
}) {
  const router = useRouter();
  const images = menu.format === 'image_gallery' ? menuImageUrls(menu) : [];
  const external = menu.format === 'pdf' ? menuPdfUrl(menu) : menu.url;

  return (
    <SafeArea edges={['top', 'bottom']} className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 border-b border-border bg-surface-raised px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          aria-label="Close menu viewer"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-sunken"
        >
          <X size={22} color="currentColor" />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text className="truncate text-sm font-semibold text-text">{menu.label}</Text>
          <Text className="truncate text-xs text-text-muted">{place.name}</Text>
        </View>
      </View>

      {menu.format === 'image_gallery' && images.length ? (
        <ScrollView className="flex-1 bg-surface-sunken">
          <View className="gap-4 p-4">
            {images.map((uri, index) => (
              <Image
                key={uri}
                source={{ uri }}
                contentFit="contain"
                accessibilityLabel={`${menu.label} menu page ${index + 1} of ${images.length}`}
                style={{ width: '100%', height: 720 }}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="max-w-lg text-center text-sm leading-6 text-text-muted">
            The native app keeps menu webpages inside the deny-by-default secure viewer and renders PDFs natively. On web, the browser itself is the secure browsing surface.
          </Text>
          {external ? (
            <Pressable
              onPress={() => void Linking.openURL(external)}
              className="rounded-lg bg-primary px-4 py-3"
            >
              <Text className="text-sm font-semibold text-on-primary">Open menu</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </SafeArea>
  );
}
