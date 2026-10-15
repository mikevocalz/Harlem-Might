import type { ReactNode } from 'react';
import type { View } from './tw';

export type DropAsset = {
  uri?: string;
  type: string;
  base64?: string;
  path?: string;
  file?: File;
  height?: number;
  width?: number;
  fileName?: string;
  text?: string;
  /** Release a web object URL when the recipient no longer needs it. Safe to repeat. */
  release?: () => void;
};

export type Assets = { assets: DropAsset[] };

export interface DropZoneProps extends Omit<React.ComponentProps<typeof View>, 'children'> {
  children?: ReactNode;
  /** Receives a complete batch and owns its assets, including their eventual release. */
  onDrop?: (event: Assets) => void;
  onDropListeningStart?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onEnter?: () => void;
  onExit?: () => void;
  includeBase64?: boolean;
  disableObjectUrl?: boolean;
  allowedMimeTypes?: (string | RegExp)[];
  draggableSources?: {
    type: 'text' | 'image' | 'video' | 'file';
    value: string;
  }[];
  className?: string;
  active?: boolean;
  title?: string;
  description?: string;
  glyph?: ReactNode;
}
