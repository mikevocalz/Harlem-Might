import { useEffect } from 'react';
import { AppState } from 'react-native';
import { haptics } from '@acme/ui/haptics';
import { DarkTheme, Slot, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind, withUniwind } from "uniwind";
import { AppQueryProvider, SafeAreaProvider } from "@acme/app";
import { Toaster } from "@acme/ui";
import { palette, semantic } from "@acme/theme";
import { metaWindows } from "../src/spatial/metaWindows";
import "../global.css";

// className-capable gesture root (third-party component → withUniwind).
// Module scope, not render scope — withUniwind builds the wrapper eagerly.
//
// Uniwind's p-safe/m-safe/safe-* utilities are NOT wired: they need insets
// pushed in via a SafeAreaListener + Uniwind.updateInsets, and nothing in this
// repo uses them (the kit ships a SafeArea component instead). Add the listener
// here if those classes are ever adopted — docs.uniwind.dev/migration-from-nativewind.
const GestureRoot = withUniwind(GestureHandlerRootView);

// Dark only, like the site (DECISIONS S14). Runs before the first render so no
// light frame paints. Uniwind 1.12.1 `setTheme('dark')` turns off its adaptive
// themes (so a system change can't flip the variant back) and calls
// `Appearance.setColorScheme('dark')` itself on native
// (node_modules/uniwind/dist/module/core/config/config.common.js).
Uniwind.setTheme("dark");

// Navigator chrome (scene background, stack headers) from the same dark
// tokens, so no light default shows behind a transition.
const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.mights.gold,
    background: semantic.surface.dark,
    card: semantic.paper.dark,
    text: semantic.text.dark,
    border: semantic["rule-hairline"].dark,
    notification: semantic.danger.dark,
  },
};

export default function RootLayout() {
  useEffect(() => {
    haptics.setForeground(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', state => {
      haptics.setForeground(state === 'active');
    });
    return () => listener.remove();
  }, []);

  return (
    <GestureRoot className="flex-1 bg-surface">
      <StatusBar style="light" />
      {/*
        Installs the native WindowInsetsAnimationCallback subscription on
        Android and handles edge-to-edge. RN's built-in KeyboardAvoidingView
        relies on LayoutAnimation and a late keyboardDidShow, so Android content
        snaps instead of tracking the keyboard curve; this gives both platforms
        the same animated keyboard-inset source.
      */}
      <KeyboardProvider>
        <SafeAreaProvider>
          <ThemeProvider value={NAV_THEME}>
          <AppQueryProvider>
            {/*
              The app's only Meta spatial scene. Explore's Place Detail window
              registers under it; the main window stays the activity. A
              fragment off the quest flavor.
            */}
            <metaWindows.SceneProvider>
              <Slot />
            </metaWindows.SceneProvider>
            <Toaster />
          </AppQueryProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureRoot>
  );
}
