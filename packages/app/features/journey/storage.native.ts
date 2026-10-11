import { createMMKV } from 'react-native-mmkv';
import type { JourneyStorage } from './controller.ts';
// App sandbox only. No app-group identifier, widget timeline, auth or GPS cache.
let storage: ReturnType<typeof createMMKV> | undefined;
const local = () => storage ??= createMMKV({ id: 'anonymous-walks' });
export const journeyStorage: JourneyStorage = {
  getString: key => local().getString(key),
  set: (key, value) => local().set(key, value),
  remove: key => local().remove(key),
};
