import { requireOptionalNativeModule, type EventSubscription, type NativeModule } from 'expo';
import type { PanelClosedEvent } from './PanelClosedEvent';
import type { SpatialPanels } from './SpatialPanels.types';

type Events = {
  onPanelOpened: (event: { name: string }) => void;
  onPanelClosed: (event: PanelClosedEvent) => void;
};

declare class NativeSpatialPanels extends NativeModule<Events> {
  readonly isAvailable: boolean;
  openPanel(name: string, props: Record<string, string>): Promise<void>;
  closePanel(name: string): Promise<void>;
}

// Optional: iOS, web and node:test do not link the module.
const native = requireOptionalNativeModule<NativeSpatialPanels>('SpatialPanels');

const NO_SUBSCRIPTION: EventSubscription = { remove: () => undefined };

/** The app's {@linkcode SpatialPanels}. */
export const spatialPanels: SpatialPanels = {
  get isAvailable() {
    return native?.isAvailable ?? false;
  },
  openPanel(name, props = {}) {
    if (!native) {
      return Promise.reject(new Error(`Cannot open panel ${name}: the SpatialPanels module is not linked on this platform.`));
    }
    return native.openPanel(name, props);
  },
  closePanel(name) {
    return native ? native.closePanel(name) : Promise.resolve();
  },
  addOnPanelOpenedListener(listener) {
    return native ? native.addListener('onPanelOpened', listener) : NO_SUBSCRIPTION;
  },
  addOnPanelClosedListener(listener) {
    return native ? native.addListener('onPanelClosed', listener) : NO_SUBSCRIPTION;
  },
};
