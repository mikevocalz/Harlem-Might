import { Directory, File, Paths } from 'expo-file-system';
import type { DownloadAttachment } from './download.types.ts';

/**
 * Copy a remote file into the app's document directory.
 *
 * It lands in an `attachments/` subdirectory rather than the document root so
 * the app's own files and the user's stay distinguishable when either is
 * enumerated later.
 */
export const downloadAttachment: DownloadAttachment = async (url, name, onProgress) => {
  const directory = new Directory(Paths.document, 'attachments');
  if (!directory.exists) directory.create({ intermediates: true });

  const task = File.createDownloadTask(url, new File(directory, name), {
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress({ bytesWritten, totalBytes });
    },
  });

  const file = await task.downloadAsync();
  // downloadAsync resolves null when the task is cancelled.
  return file === null ? null : file.uri;
};
