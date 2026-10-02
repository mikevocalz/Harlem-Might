// @acme/app — universal business/domain logic and shared screens.
// Screens live in features/* (Solito pattern); add domains alongside them.
export { HomeScreen } from './features/home/screen';
export { ExploreScreen } from './features/explore/screen';
export { NotificationsScreen } from './features/notifications/screen';
export { ProfileScreen } from './features/profile/screen';
export { SettingsScreen } from './features/settings/screen';
export { useProfile, AVATAR_URI, type ThemePreference } from './features/profile/profile.store';
export { ScheduleScreen } from './features/schedule/screen';
export { MenuButton } from './features/home/menu-button';
export { DEMO_RESOURCES, DEMO_DAY, DEMO_NOW } from './features/schedule/fixtures';
export { useScheduleStore } from './features/schedule/store';
export { MiniCalendar } from './features/schedule/MiniCalendar';
export { BookingForm, type BookingFormProps } from './features/schedule/BookingForm';
export { formatTimeRange } from './features/schedule/format';
export type { ScheduleEvent, Resource } from './features/schedule/model';
export { ErrorScreen } from './features/error/screen';
export { AppQueryProvider, createQueryClient } from './providers/query-provider';
export { SafeAreaProvider } from './providers/safe-area';
export * from './features/editor';

export { ExploreMasterPane } from './features/explore/ExploreMasterPane';
export { ExploreMapPane } from './features/explore/ExploreMapPane';
export { ExplorePlaceDetail } from './features/explore/ExplorePlaceDetail';
export { ExploreEmptyDetail } from './features/explore/ExploreEmptyDetail';
export { MightsPanel } from './features/explore/MightsPanel';
export {
  HARLEM_PLACE_PREVIEWS,
  HARLEM_CATEGORIES,
  getHarlemPlacePreview,
  useExplore,
  type HarlemPlacePreview,
} from './features/explore/explore.store';
