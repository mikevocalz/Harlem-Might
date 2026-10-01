import type { DownloadAttachment } from './download.types.ts';

/**
 * Pull a remote file into an object URL.
 *
 * expo-file-system exists on web only as a set of no-op warnings, and the
 * browser has no document directory to write into anyway, so the transfer lands
 * in memory and the document references it by `blob:` URL.
 *
 * The body is read chunk by chunk instead of with `response.blob()`, which
 * would hide the transfer entirely: the bar in AttachSheet is only worth
 * drawing if the bytes behind it are real (see attachment.ts).
 */
export const downloadAttachment: DownloadAttachment = async (url, _name, onProgress) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch that file (${response.status}).`);

  const declared = Number(response.headers.get('content-length') ?? 0);
  const totalBytes = Number.isFinite(declared) ? declared : 0;
  const body = response.body;

  // A body-less response still yields the file; it just cannot be measured on
  // the way in, which attachment.ts reports as an indeterminate transfer.
  if (body === null) {
    const whole = await response.blob();
    onProgress({ bytesWritten: whole.size, totalBytes: whole.size });
    return URL.createObjectURL(whole);
  }

  const reader = body.getReader();
  const chunks: BlobPart[] = [];
  let bytesWritten = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as BlobPart);
    bytesWritten += value.byteLength;
    onProgress({ bytesWritten, totalBytes });
  }

  return URL.createObjectURL(new Blob(chunks));
};
