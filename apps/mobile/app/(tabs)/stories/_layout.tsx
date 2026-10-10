import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

/**
 * The Stories tab: the index at `/stories` and each story at
 * `/stories/[slug]`, the same paths as `routes.stories()` and
 * `routes.story(slug)` on the site. Pages draw their own H1, so the header
 * carries only the back control.
 */
export default function StoriesLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
