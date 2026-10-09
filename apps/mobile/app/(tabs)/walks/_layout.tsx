import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

export default function WalksLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
