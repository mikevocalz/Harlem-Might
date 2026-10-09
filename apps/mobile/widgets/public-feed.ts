import { createMMKV } from 'react-native-mmkv';
import { WIDGET_SCHEMA_VERSION, type WidgetSnapshot } from '@acme/widgets';

/**
 * Public widget snapshot only. Do not persist tokens, member emails, precise
 * coordinates, or raw Payload member rows in this shared projection.
 * Never cache stale events as if they were current.
 */
const storage = createMMKV({ id: 'harlem-might-public-widgets-v1' });
const SNAPSHOT_KEY = 'published-snapshot';

function isSnapshot(value: unknown): value is WidgetSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<WidgetSnapshot>;
  if (v.schemaVersion !== WIDGET_SCHEMA_VERSION ||
      typeof v.generatedAt !== 'string' || typeof v.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(v.expiresAt))) return false;
  return (['story', 'event', 'place', 'walk'] as const).every(kind => {
    const card = v[kind];
    return card === null || !!card &&
      typeof card === 'object' && card.kind === kind &&
      typeof card.title === 'string' && typeof card.path === 'string';
  });
}

export function loadPublicSnapshot(): WidgetSnapshot | null {
  try {
    const raw = storage.getString(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storePublicSnapshot(snapshot: WidgetSnapshot): void {
  if (!isSnapshot(snapshot)) throw new Error('Invalid widget snapshot');
  storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

/**
 * Fetch from Harlem Might's public, server-curated endpoint only, never from
 * an arbitrary URL in a widget. A missing env var leaves honest empty states.
 */
export async function refreshPublicSnapshot(): Promise<WidgetSnapshot | null> {
  const endpoint = process.env.EXPO_PUBLIC_WIDGET_FEED_URL;
  if (!endpoint || !/^https:\/\//i.test(endpoint)) return loadPublicSnapshot();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return loadPublicSnapshot();
    const payload: unknown = await response.json();
    if (!isSnapshot(payload)) return loadPublicSnapshot();
    storePublicSnapshot(payload);
    return payload;
  } catch {
    return loadPublicSnapshot();
  } finally {
    clearTimeout(timeout);
  }
}
