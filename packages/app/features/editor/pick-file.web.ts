import type { PickFile, PickedFile } from './pick-file.types.ts';
import { createAttachmentObjectUrl } from './object-url.web.ts';

/**
 * The browser's own file dialog.
 *
 * expo-file-system's `pickFileAsync` only warns on web, so the input is built
 * here. It is DETACHED rather than rendered into the sheet: a hidden input in
 * the tree has to be visually removed without becoming unreachable to a
 * keyboard, and the sheet's "Choose file" button is already the affordance.
 *
 * `cancel` is what settles a dismissed dialog — without it the promise would
 * hang forever on the (common) case of the user backing out.
 */
export const pickFile: PickFile = () => {
  const input = document.createElement('input');
  input.type = 'file';

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      input.removeEventListener('cancel', cancel);
      input.removeEventListener('change', change);
    };
    const finish = (result: PickedFile | null) => { cleanup(); resolve(result); };
    const cancel = () => finish(null);
    const change = () => {
      if (settled) return;
      try {
        const file = input.files?.[0];
        finish(file === undefined ? null : { ...createAttachmentObjectUrl(file), name: file.name });
      } catch (cause) {
        cleanup();
        reject(cause);
      }
    };
    input.addEventListener('cancel', cancel, { once: true });
    input.addEventListener('change', change, { once: true });
    try {
      input.click();
    } catch (cause) {
      cleanup();
      reject(cause);
    }
  });
};
