import * as ImagePicker from 'expo-image-picker';

/**
 * Pick an image for the notes editor.
 *
 * Returns the dimensions alongside the uri because the editor's `setImage`
 * command needs them up front — it cannot measure a remote asset itself, and
 * inserting without a size collapses the image to nothing.
 *
 * Returns null when the user cancels or declines permission, which the caller
 * treats as "do nothing" rather than an error worth surfacing.
 */
export async function pickNoteImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  return { uri: asset.uri, width: asset.width, height: asset.height };
}
