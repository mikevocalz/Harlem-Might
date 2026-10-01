/**
 * RN globals for web bundlers (Turbopack has no DefinePlugin): transpiled RN
 * packages read __DEV__ and process.env.EXPO_OS at module scope (babel-preset-
 * expo inlines these on native; the web bundler does not). Imported FIRST by
 * tw.tsx/primitives so ordering holds for every entry point.
 */
declare const globalThis: Record<string, any>;

if (typeof globalThis.__DEV__ === 'undefined') {
  globalThis.__DEV__ =
    typeof globalThis.process !== 'undefined'
      ? globalThis.process.env?.NODE_ENV !== 'production'
      : false;
}

// expo-modules (expo-image etc.) read process.env.EXPO_OS at module scope
globalThis.process ??= { env: {} };
globalThis.process.env ??= {};
// SSR and browser both: outside Metro nothing inlines this, so define it.
globalThis.process.env.EXPO_OS ??= 'web';
export {};
