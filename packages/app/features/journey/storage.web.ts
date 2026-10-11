import type { JourneyStorage } from './controller.ts';
export const journeyStorage: JourneyStorage = {
  getString: key => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => { if (!globalThis.localStorage) throw new Error('Private local storage unavailable'); globalThis.localStorage.setItem(key, value); },
  remove: key => globalThis.localStorage?.removeItem(key),
};
