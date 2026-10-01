// RN globals for transpiled RN packages (replaces webpack DefinePlugin).
declare const globalThis: Record<string, unknown>;
declare const process: { env: Record<string, string | undefined> };
if (typeof globalThis.__DEV__ === 'undefined') {
  globalThis.__DEV__ = process.env.NODE_ENV !== 'production';
}
export {};
