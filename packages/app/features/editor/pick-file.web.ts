import type { PickFile } from './pick-file.types.ts';

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

  return new Promise((resolve) => {
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0];
        resolve(file === undefined ? null : { uri: URL.createObjectURL(file), name: file.name });
      },
      { once: true },
    );
    input.click();
  });
};
