'use client';
import { useAudioStore } from './audio.store.ts';

/**
 * Recording is native-only here.
 *
 * `react-native-audio-api`'s recorder needs a microphone session the browser
 * exposes through a different API entirely (`MediaRecorder`), so rather than
 * ship a dialog that cannot record, the web build resolves the request as
 * cancelled and the capability does nothing. The button is hidden on web by the
 * same mechanism — `isEnabled` — rather than failing after the user taps it.
 */
export function AudioRecorderSheet() {
  const open = useAudioStore((state) => state.open);
  const resolve = useAudioStore((state) => state.resolve);

  if (open) resolve(null);
  return null;
}
