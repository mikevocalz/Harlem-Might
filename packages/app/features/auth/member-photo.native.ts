import * as ImagePicker from 'expo-image-picker';

export interface MemberPhotoAsset {
  /** Preview URL — an object URL on web, a file:// URI on native. */
  uri: string;
  fileName: string;
  mimeType: string;
  /** The browser File for the upload (web only; native uploads from `uri`). */
  file?: File;
}

/**
 * Opens the system photo library for one image, cropped square for the avatar
 * tile. Resolves `null` when the member cancels; the picker handles the
 * permission prompt itself.
 */
export async function pickMemberPhoto(): Promise<MemberPhotoAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset
    ? {
        uri: asset.uri,
        fileName: asset.fileName ?? 'member-photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      }
    : null;
}
