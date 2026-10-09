// App entry: expo-router's root, plus the surfaces Horizon OS panels render.
import 'expo-router/entry';
import { AppRegistry } from 'react-native';
import { PLACE_DETAIL_PANEL } from './src/spatial/placeDetailPanel';

// Android's headless widget task must be registered once outside the
// component lifecycle, never in a React hook.
if (process.env.EXPO_OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widgets/android/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

// Registered here, not in a route module, so a panel can start even if the
// OS restores it before the main window has rendered a route. Required
// lazily: only the quest build ever opens it.
AppRegistry.registerComponent(
  PLACE_DETAIL_PANEL,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('./src/spatial/panels/PlaceDetailPanel').PlaceDetailPanel,
);
