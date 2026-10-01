/** A file the user chose, ready to hand to `attach`. */
export interface PickedFile {
  uri: string;
  name: string;
}

/** Resolves null when the picker was dismissed without a choice. */
export type PickFile = () => Promise<PickedFile | null>;
