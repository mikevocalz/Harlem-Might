import { Stack } from 'expo-router';

/** Member auth is a separate, chrome-light stack; public tabs stay below it. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
