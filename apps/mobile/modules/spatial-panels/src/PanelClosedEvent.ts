// eslint-disable-next-line @typescript-eslint/no-unused-vars -- resolves the {@linkcode} targets below
import type { SpatialPanels } from './SpatialPanels.types';

/**
 * Sent when a panel opened with {@linkcode SpatialPanels.openPanel} goes away.
 *
 * @see {@linkcode SpatialPanels.addOnPanelClosedListener}
 */
export interface PanelClosedEvent {
  /** The registered component name the panel rendered. */
  name: string;
  /**
   * `app` when JS closed it with {@linkcode SpatialPanels.closePanel};
   * `user` for the panel's close control, Back, or the OS removing it.
   */
  reason: 'app' | 'user';
}
