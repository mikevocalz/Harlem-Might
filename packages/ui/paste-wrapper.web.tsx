'use client';
/**
 * PLATFORM FORK — expo-paste-input's web build is a no-op stub (it drops
 * onPaste entirely), so the web fork implements the equivalent directly on the
 * DOM ClipboardEvent API, matching the native payload contract:
 * - image/GIF files on the clipboard → preventDefault + `{ type: 'images' }`
 *   with object URLs (the browser would otherwise insert the file NAME as text)
 * - plain text → `{ type: 'text' }`; default insertion proceeds, so controlled
 *   inputs still receive it via onChangeText — do not append it yourself
 * `display: contents` keeps the wrapper out of layout.
 */
import type { PasteEventPayload } from 'expo-paste-input';

export interface PasteWrapperProps {
  onPaste?: (payload: PasteEventPayload) => void;
  children?: React.ReactNode;
}

export function PasteWrapper({ onPaste, children }: PasteWrapperProps) {
  const handlePaste = (e: React.ClipboardEvent) => {
    if (!onPaste) return;
    const images = Array.from(e.clipboardData?.files ?? []).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (images.length) {
      e.preventDefault();
      onPaste({ type: 'images', uris: images.map((f) => URL.createObjectURL(f)) });
      return;
    }
    const text = e.clipboardData?.getData('text/plain');
    if (text) onPaste({ type: 'text', value: text });
    else onPaste({ type: 'unsupported' });
  };

  return (
    <div style={{ display: 'contents' }} onPaste={handlePaste}>
      {children}
    </div>
  );
}
