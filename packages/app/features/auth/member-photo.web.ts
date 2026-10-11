export interface MemberPhotoAsset {
  /** Preview URL — an object URL on web, a file:// URI on native. */
  uri: string;
  fileName: string;
  mimeType: string;
  /** The browser File for the upload (web only; native uploads from `uri`). */
  file?: File;
}

/**
 * Opens the browser's file picker for one image. Resolves `null` when the
 * member cancels. The File doubles as the upload payload; an object URL gives
 * the instant preview before the server round trip.
 */
export function pickMemberPhoto(): Promise<MemberPhotoAsset | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(
        file
          ? {
              uri: URL.createObjectURL(file),
              file,
              fileName: file.name,
              mimeType: file.type || 'image/jpeg',
            }
          : null,
      );
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
