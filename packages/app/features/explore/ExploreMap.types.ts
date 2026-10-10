import type { HarlemPlacePreview } from './explore.store';

/** Space in dp the map keeps clear of, so overlays never cover a place. */
export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ExploreMapProps {
  /** A marker was chosen. The caller opens the place. */
  onSelectPlace: (place: HarlemPlacePreview) => void;
  /** Room taken by panes or panels drawn over the map. */
  insets: MapInsets;
}
