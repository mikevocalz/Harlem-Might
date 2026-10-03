'use client';

import { Pressable, Text, View } from '@acme/ui/tw';
import { MightsButton, MightsPage, MightsText, cornerCut, expanded, routes } from '@acme/ui/mights';

// Error boundary for the site. Says what happened and offers a way forward;
// the raw message is for logs, not visitors.
export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return (
    <MightsPage title="This page didn't load" lead="Something went wrong on our side. Try again, or head back to the map.">
      <View className="flex-row flex-wrap gap-3">
        <Pressable onPress={retry} className="mights-focus">
          <View className={`h-[52px] justify-center bg-primary px-8 ${cornerCut}`}>
            <Text className={`text-[15px] font-semibold text-on-primary ${expanded}`}>Try again</Text>
          </View>
        </Pressable>
        <MightsButton href={routes.explore()} variant="secondary">
          Open the map
        </MightsButton>
      </View>
      <MightsText size="small">If this keeps happening, reload the page.</MightsText>
    </MightsPage>
  );
}
