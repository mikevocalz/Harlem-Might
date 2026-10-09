import type { WidgetSnapshot } from '@acme/widgets';

// Browser surfaces use the normal Harlem Might web UI, not native home widgets.
// Never load react-native-mmkv in a server/web bundle.
export const loadPublicSnapshot = (): WidgetSnapshot | null => null;
export const storePublicSnapshot = (_snapshot: WidgetSnapshot): void => {};
export async function refreshPublicSnapshot(): Promise<WidgetSnapshot | null> { return null; }
