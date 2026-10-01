import { File } from 'expo-file-system';
import { fileNameFrom } from './attachment.ts';
import type { PickFile } from './pick-file.types.ts';

/**
 * The platform document picker, via expo-file-system rather than a second
 * picker dependency — the app already depends on it to move the file.
 */
export const pickFile: PickFile = async () => {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;
  return { uri: picked.result.uri, name: fileNameFrom(picked.result.uri) };
};
