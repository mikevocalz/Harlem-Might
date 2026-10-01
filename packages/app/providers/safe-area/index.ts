// TS resolution anchor — bundlers load the .native/.web forks.
// Solito pattern: native wraps react-native-safe-area-context's provider;
// web is a pass-through (the browser has no unsafe areas to provide).
export { SafeAreaProvider } from './index.web';
