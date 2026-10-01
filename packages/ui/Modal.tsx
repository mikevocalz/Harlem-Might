'use client';

import { Modal as ReactNativeModal, type ModalProps as ReactNativeModalProps } from 'react-native';

/**
 * Portal/modal boundary for app code.
 *
 * Expo UI does not currently expose a universal dialog primitive. Keeping the
 * React Native portal here means feature code never imports visual primitives
 * from react-native directly, and this implementation can be replaced centrally
 * when Expo ships a universal dialog.
 */
export type ModalProps = ReactNativeModalProps;

export function Modal(props: ModalProps) {
  return <ReactNativeModal {...props} />;
}
