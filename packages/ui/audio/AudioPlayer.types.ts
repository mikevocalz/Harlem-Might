export interface AudioPlayerProps {
  /** File or remote URI of the recording. */
  uri: string;
  /** Length in seconds, when the caller already knows it. */
  duration?: number;
  /** Levels captured at record time. Omitted, the player decodes the file. */
  levels?: readonly number[];
  /** Shown above the waveform. */
  label?: string;
  className?: string;
}
