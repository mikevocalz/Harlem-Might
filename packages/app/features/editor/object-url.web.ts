/** A transient browser resource; its recipient owns eventual, idempotent release. */
export function createAttachmentObjectUrl(blob: Blob): { uri: string; release: () => void } {
  const uri = URL.createObjectURL(blob);
  let released = false;
  return { uri, release: () => {
    if (!released) {
      released = true;
      URL.revokeObjectURL(uri);
    }
  } };
}
