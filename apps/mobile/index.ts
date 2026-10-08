import 'expo-router/entry';

// Expo Router owns root registration. Android's headless widget task must be
// registered once outside the component lifecycle, never in a React hook.
if (process.env.EXPO_OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widgets/android/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
