// @acme/app — universal business/domain logic and shared screens.
// Screens live in features/* (Solito pattern); add domains alongside them.
export { ErrorScreen } from './features/error/screen';
export { MemberAuthScreen, type MemberAuthIntent } from './features/auth/MemberAuthScreen';
export { AppQueryProvider, createQueryClient } from './providers/query-provider';
export { SafeAreaProvider } from './providers/safe-area';
export * from './features/editor';

export { ExploreMasterPane } from './features/explore/ExploreMasterPane';
export { ExploreMapPane } from './features/explore/ExploreMapPane';
export { ExplorePlaceDetail } from './features/explore/ExplorePlaceDetail';
export { MightsAssistant, type MightsAssistantProps } from './features/explore/MightsAssistant';
export { ExploreTypeContext, useExploreType, type ExploreTypeScale } from './features/explore/explore-type';
export { moveFocusTo, rowFocusId, markerFocusId } from './features/explore/focus-registry';
export type { MapInsets } from './features/explore/ExploreMapPane';
export {
  HARLEM_PLACE_PREVIEWS,
  HARLEM_CATEGORIES,
  getHarlemPlacePreview,
  filterPlaces,
  placesNear,
  haversine,
  MAPPED_PLACES,
  UNMAPPED_PLACES,
  useExplore,
  type ExplorePlace,
  type HarlemPlacePreview,
} from './features/explore/explore.store';
export { exploreCategories, explorePlaceFromRecord } from './features/explore/catalogue';
export {
  useMightsAssistant,
  ASSISTANT_RIVE_ACTIVITY,
  type AssistantActivity,
} from './features/explore/mights-assistant.store';
export * from './features/navigation/ui';
