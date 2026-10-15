/** A file the user chose, ready to hand to `attach`. */
export interface PickedFile {
  uri: string;
  name: string;
  /** Release an owned web object URL when no longer needed. Safe to repeat. */
  release?: () => void;
}

/** Resolves null when the picker was dismissed without a choice. */
export type PickFile = () => Promise<PickedFile | null>;
