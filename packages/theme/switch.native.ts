// User theme override — native. Appearance drives light-dark() resolution.
// MMKV persistence arrives with the state infra (PROMPT-8); until then the
// override lasts for the session.
import { Appearance } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'app-theme';

export function setThemePreference(pref: ThemePreference) {
  // RN 0.87 renames this sentinel: 'unspecified' -> 'auto'. It cannot change
  // yet — on RN 0.86 `ColorSchemeName` is 'light' | 'dark' | 'unspecified' and
  // 'auto' is a type error. Flip it in the same PR as the 0.87 bump (WS-5).
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}
