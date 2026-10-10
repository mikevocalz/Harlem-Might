'use client';

import { useReducedMotion } from "@acme/ui";
import { Text, View } from "@acme/ui/tw";
import { ExploreLoader } from "@acme/spatial/explore-loader";

// The loading state for Walks, Stories and Today, on web (Suspense fallback)
// and mobile (no result yet). Same Rive loader as Explore so every wait in
// the app looks the same. `hm-suspense-in` holds it invisible for 250 ms on
// web, so a warm cache shows nothing.
export function ContentLoader({ label }: { label: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <View
      role="status"
      className="hm-suspense-in min-h-80 items-center justify-center py-16"
    >
      <Text className="sr-only">{label}</Text>
      <ExploreLoader
        size={120}
        phase={reducedMotion ? "reduced" : "loading"}
        label={label}
      />
    </View>
  );
}
