/**
 * Where a voice note goes after it is recorded.
 *
 * The recording is uploaded and then DELETED from the device, so nothing in a
 * saved note may point at a local path — a `file://` URI is dead the moment the
 * upload succeeds, and a note that outlives the file shows a broken player.
 *
 * This also unblocks inline audio. The editor is a span-based EditText: an
 * inline node is a Drawable, and `setImage` accepts only an http(s) URL or a
 * file on disk (see EnrichedImageSpan.prepareDrawableForImage). A voice note
 * has no picture of its own, which is why it could not go inline while a video
 * could — YouTube hosts a thumbnail. Once the server returns a rendered
 * waveform image, audio becomes inline by exactly the same mechanism.
 */
export interface UploadedVoiceNote {
  /** Playable audio, served remotely. Replaces the local recording. */
  audioUrl: string;
  /**
   * A rendered waveform for this recording, served remotely.
   *
   * MUST live beside the audio under a shared id — `<base>/<id>/waveform.png`
   * next to `<base>/<id>/audio.m4a` — because the inline node carries only this
   * URL, and the audio URL has to be recoverable from it. See
   * `audioUrlFromWaveform`.
   */
  waveformUrl: string;
  /** Seconds. Measured at record time; the server need not re-derive it. */
  duration: number;
}

export type UploadVoiceNote = (localUri: string, duration: number) => Promise<UploadedVoiceNote>;

/** The shared-id convention above, as code. */
const WAVEFORM = /^(.*)\/waveform\.(png|jpg|jpeg|webp)$/i;

/** The audio URL for an inline waveform image, or null if it is not one. */
export function audioUrlFromWaveform(src: string, extension = 'm4a'): string | null {
  const match = WAVEFORM.exec(src);
  return match?.[1] === undefined ? null : `${match[1]}/audio.${extension}`;
}

/** Whether a URL is one of our inline waveform images. */
export function isWaveformUrl(src: string): boolean {
  return WAVEFORM.test(src);
}

/** 16:5 — wide and short, so a waveform reads as audio rather than a photo. */
export const INLINE_WAVEFORM_WIDTH = 320;
export const INLINE_WAVEFORM_HEIGHT = 100;
