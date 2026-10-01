/** Bytes moved so far. `totalBytes` is 0 when the source reports no length. */
export interface DownloadProgress {
  bytesWritten: number;
  totalBytes: number;
}

/** Resolves the local URI the file now lives at, or null when it was cancelled. */
export type DownloadAttachment = (
  url: string,
  name: string,
  onProgress: (progress: DownloadProgress) => void,
) => Promise<string | null>;
