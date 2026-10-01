'use client';
import { useUrlStore } from './url.store.ts';

/**
 * Web already has a usable prompt, and `prompt-url.web` uses it — so this only
 * needs to keep the request from hanging if it is ever routed here.
 */
export function UrlSheet() {
  const open = useUrlStore((state) => state.open);
  const resolve = useUrlStore((state) => state.resolve);
  if (open) resolve(null);
  return null;
}
