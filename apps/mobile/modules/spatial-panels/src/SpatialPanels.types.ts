import type { EventSubscription } from 'expo';
import type { PanelClosedEvent } from './PanelClosedEvent';

/**
 * Opens React Native components as separate Meta Horizon OS panels, beside
 * the app's main panel. Each panel is a second surface on the app's one
 * React Native runtime, so module state (Zustand stores included) is shared
 * with the main window. Exposed as {@linkcode spatialPanels}.
 *
 * Placement belongs to the OS: Meta documents only that the panel opens
 * "next to" the launching panel, and the user can move it.
 */
export interface SpatialPanels {
  /**
   * True only on builds whose manifest declares the panel activity (the quest
   * flavor). On every other build {@linkcode SpatialPanels.openPanel} rejects,
   * so render the content in the main window instead.
   */
  readonly isAvailable: boolean;

  /**
   * Opens `name`, a component registered with `AppRegistry.registerComponent`,
   * in its own panel. Resolves once the launch is handed to the OS; listen
   * with {@linkcode SpatialPanels.addOnPanelOpenedListener} to learn when it
   * is on screen. Opening a name that is already open does nothing; update
   * what it shows through shared state.
   *
   * @param props Initial props, delivered to the component as strings.
   * @throws When {@linkcode SpatialPanels.isAvailable} is false, or the app has
   *   no current activity to launch from.
   */
  openPanel(name: string, props?: Record<string, string>): Promise<void>;

  /**
   * Closes the panel showing `name`. Resolves without effect when none is
   * open. The close event reports `reason: 'app'`.
   */
  closePanel(name: string): Promise<void>;

  /** Called each time a panel finishes opening. */
  addOnPanelOpenedListener(listener: (event: { name: string }) => void): EventSubscription;

  /** Called each time a panel closes, with {@linkcode PanelClosedEvent.reason}. */
  addOnPanelClosedListener(listener: (event: PanelClosedEvent) => void): EventSubscription;
}
