import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { withUniwind } from "uniwind";
import { AppQueryProvider, SafeAreaProvider } from "@acme/app";
import { BookingSheet } from "../components/BookingSheet";
import { AttachSheet, AudioRecorderSheet, UrlSheet } from "@acme/app";
import { Toaster } from "@acme/ui";
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

export default function RootLayout() {
  return (
    <GestureRoot className="flex-1">
      <StatusBar style="auto" />
      {/*
        Installs the native WindowInsetsAnimationCallback subscription on
        Android and handles edge-to-edge. RN's built-in KeyboardAvoidingView
        relies on LayoutAnimation and a late keyboardDidShow, so Android content
        snaps instead of tracking the keyboard curve; this gives both platforms
        the same animated keyboard-inset source.
      */}
      <KeyboardProvider>
        <SafeAreaProvider>
          <AppQueryProvider>
            {/*
              The app's only Meta spatial scene. Explore's Discover and Place
              Detail windows register under it; the main window stays the
              activity. A fragment off the quest flavor.
            */}
            <metaWindows.SceneProvider>
              <Slot />
            </metaWindows.SceneProvider>
            {/* Global overlays/sheets are mounted once at the app root. */}
            <BookingSheet />
            <AttachSheet />
            <AudioRecorderSheet />
            <UrlSheet />
            <Toaster />
          </AppQueryProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureRoot>
  );
}
