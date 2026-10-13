/** Bytes moved so far. `totalBytes` is 0 when the source reports no length. */
export interface DownloadProgress {
  bytesWritten: number;
  totalBytes: number;
}

/**
 * Resolves the local URI the file now lives at, or null when it was cancelled.
 * `onRelease` optionally receives ownership of transient resources before the
 * URI resolves. Its callback is idempotent. Without it, web callers retain the
 * original responsibility to revoke their returned object URL themselves.
 * Native downloads are durable files and do not publish browser cleanup.
 */
export type DownloadAttachment = (
  url: string,
  name: string,
  onProgress: (progress: DownloadProgress) => void,
  onRelease?: (release: () => void) => void,
) => Promise<string | null>;
