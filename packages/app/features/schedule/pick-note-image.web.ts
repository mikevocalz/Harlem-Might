/**
 * Browser image picker with the same contract as the Expo native fork.
 * The helper stays non-visual: the browser's file chooser is the platform UI.
 */
export async function pickNoteImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  const file = await new Promise<File | null>((resolve) => {
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener(
      'change',
      () => resolve(input.files?.[0] ?? null),
      { once: true },
    );
    input.click();
  });

  if (!file) return null;

  const uri = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Could not read image dimensions'));
      image.src = uri;
    });

    // The editor consumes the object URL after this helper returns, so do not
    // revoke it here. The editor/session owns that URL's lifetime.
    return { uri, ...dimensions };
  } catch (error) {
    URL.revokeObjectURL(uri);
    throw error;
  }
}
