import { downloadAttachment } from './download';

export interface Attachment {
  /** URI to store in the document. */
  uri: string;
  name: string;
}

export type AttachPhase = 'idle' | 'attaching' | 'done' | 'error';

export interface AttachProgress {
  phase: AttachPhase;
  /** 0–1. Meaningful only while `phase` is 'attaching' and the size is known. */
  ratio: number;
  /** Null when the source reports no length — see `attach` for why. */
  bytesTotal: number | null;
  name: string | null;
  error: string | null;
}

export const IDLE_PROGRESS: AttachProgress = {
  phase: 'idle',
  ratio: 0,
  bytesTotal: null,
  name: null,
  error: null,
};

const REMOTE = /^https?:\/\//i;

/** Filename from a URI, falling back to something stable rather than empty. */
export function fileNameFrom(uri: string): string {
  const last = uri.split('?')[0]?.split('/').pop();
  return last !== undefined && last.length > 0 ? decodeURIComponent(last) : 'attachment';
}

/**
 * Bring a dropped or picked file into the app and report progress.
 *
 * WHAT THE PERCENTAGE MEANS, honestly:
 *
 * - A REMOTE url is downloaded by `downloadAttachment`, which reports real
 *   `bytesWritten / totalBytes` on both platforms. The bar tracks an actual
 *   transfer.
 * - A LOCAL uri — anything dropped from another app, or chosen from the picker
 *   — is already on the device. There is no transfer to measure, so it reports
 *   completion immediately instead of animating a bar for a copy that already
 *   happened. A progress bar with nothing behind it is theatre, and it teaches
 *   people to distrust the ones that mean something.
 *
 * `totalBytes` can be 0 when a server sends no content-length; the ratio then
 * stays 0 and the caller shows an indeterminate state rather than dividing by
 * zero and rendering NaN%.
 */
export async function attach(
  source: { uri: string; name?: string },
  onProgress: (progress: AttachProgress) => void,
): Promise<Attachment | null> {
  const name = source.name ?? fileNameFrom(source.uri);

  if (!REMOTE.test(source.uri)) {
    onProgress({ phase: 'done', ratio: 1, bytesTotal: null, name, error: null });
    return { uri: source.uri, name };
  }

  onProgress({ phase: 'attaching', ratio: 0, bytesTotal: null, name, error: null });

  try {
    const uri = await downloadAttachment(source.uri, name, ({ bytesWritten, totalBytes }) => {
      onProgress({
        phase: 'attaching',
        ratio: totalBytes > 0 ? bytesWritten / totalBytes : 0,
        bytesTotal: totalBytes > 0 ? totalBytes : null,
        name,
        error: null,
      });
    });

    // A cancelled transfer resolves null, and must not be reported as a
    // completed one.
    if (uri === null) {
      onProgress(IDLE_PROGRESS);
      return null;
    }
    onProgress({ phase: 'done', ratio: 1, bytesTotal: null, name, error: null });
    return { uri, name };
  } catch (cause) {
    onProgress({
      phase: 'error',
      ratio: 0,
      bytesTotal: null,
      name,
      error: cause instanceof Error ? cause.message : 'Could not attach that file.',
    });
    return null;
  }
}
