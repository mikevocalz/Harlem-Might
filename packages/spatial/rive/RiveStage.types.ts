export interface RiveStageProps {
  /** A remote URL or a bundled `require('./file.riv')`. */
  source: string | number;
  artboard?: string;
  /**
   * Required: @rive-app/react-native only plays state machines. A file with
   * only linear animations (e.g. cdn.rive.app/animations/vehicles.riv) logs
   * "State machine not found for advance" on every frame.
   */
  stateMachine: string;
  autoplay?: boolean;
  className?: string;
  height?: number;
}
