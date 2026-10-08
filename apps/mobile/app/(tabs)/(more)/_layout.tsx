import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'more' };

/**
 * The More tab. A group, so its pages keep the site's paths: the list is
 * `/more` and the AR concept page is `/ar`, the same href as `routes.ar()`
 * on the site. A stack, so AR pushes inside the tab and Back returns to the
 * list. Pages draw their own H1, so the header carries only the back control.
 * Colours come from the root ThemeProvider.
 */
export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitle: '',
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="more" options={{ headerShown: false }} />
      <Stack.Screen name="ar" />
    </Stack>
  );
}
