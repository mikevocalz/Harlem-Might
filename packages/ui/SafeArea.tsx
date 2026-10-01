// TS resolution anchor — bundlers load the .native/.web forks.
// Solito pattern: only the native fork touches react-native-safe-area-context;
// the web bundle must never import it (its spec chain is raw Flow-typed RN).
export { SafeArea, type SafeAreaProps } from './SafeArea.web';
