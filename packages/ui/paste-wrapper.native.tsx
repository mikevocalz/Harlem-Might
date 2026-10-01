'use client';
// Native paste interception (images / GIFs from the clipboard) via
// expo-paste-input's wrapper view. Plain text pastes flow into the wrapped
// TextInput normally; rich content fires onPaste instead.
import { TextInputWrapper, type PasteEventPayload } from 'expo-paste-input';

export interface PasteWrapperProps {
  onPaste?: (payload: PasteEventPayload) => void;
  children?: React.ReactNode;
}

export function PasteWrapper({ onPaste, children }: PasteWrapperProps) {
  return <TextInputWrapper onPaste={onPaste}>{children}</TextInputWrapper>;
}
