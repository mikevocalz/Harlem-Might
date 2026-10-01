import { Alert } from 'react-native';

/**
 * Collect a URL from the user.
 *
 * `Alert.prompt` is iOS-only in React Native, so Android would silently get
 * nothing back. Rather than ship a dialog that works on one platform, this
 * resolves through a single implementation both platforms have: an alert with
 * the clipboard-free path is not possible, so Android falls back to the
 * caller's own UI by resolving null — the capability then does nothing rather
 * than pretending to.
 *
 * A proper in-app URL dialog belongs in the kit; this keeps the capability
 * honest until it exists.
 */
export function promptUrl(title: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (Alert.prompt === undefined) {
      resolve(null);
      return;
    }
    Alert.prompt(
      title,
      undefined,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Add', onPress: (value?: string) => resolve(value?.trim() ? value.trim() : null) },
      ],
      'plain-text',
      '',
      'url',
    );
  });
}
