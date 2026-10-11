import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

/**
 * The Music tab: the index at `/music` and each artist at
 * `/music/[slug]`, the same paths as `routes.music()` and
 * `routes.musician(slug)` on the site. Pages draw their own H1, so the header
 * carries only the back control.
 */
export default function MusicLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
