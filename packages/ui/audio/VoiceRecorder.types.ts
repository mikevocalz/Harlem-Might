export interface VoiceRecording {
  /** File URI of the finished take. */
  uri: string;
  /** Length in seconds, as reported by the recorder. */
  duration: number;
  /** The levels captured while recording, for the player to draw. */
  levels: number[];
}

export interface VoiceRecorderProps {
  /** Called with the finished take. */
  onComplete: (recording: VoiceRecording) => void;
  /** Called when the user abandons the take. */
  onCancel: () => void;
  /** Stop automatically at this many seconds. Omit for no limit. */
  maxSeconds?: number;
  className?: string;
}
