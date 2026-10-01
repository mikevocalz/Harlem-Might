/** Web has a real prompt; the native fork explains why it is not universal. */
export function promptUrl(title: string): Promise<string | null> {
  const value = globalThis.prompt?.(title) ?? null;
  return Promise.resolve(value?.trim() ? value.trim() : null);
}
