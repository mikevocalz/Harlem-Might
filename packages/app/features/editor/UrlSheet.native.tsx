"use client";
import { useMemo } from "react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { createStore, useStore } from "zustand";
import { Button, Modal, TextField } from "@acme/ui";
import { Pressable, Text, View } from "@acme/ui/tw";
import { Link as LinkIcon, Video, X } from "@acme/ui/icons";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { youTubeVideoId } from "./youtube.ts";
import { useUrlStore } from "./url.store.ts";

function createDraftStore() {
  return createStore<{ value: string; set: (value: string) => void }>(
    (set) => ({
      value: "",
      set: (value) => set({ value }),
    }),
  );
}

/**
 * Collect a URL.
 *
 * Built rather than delegated to `Alert.prompt`, which exists only on iOS.
 *
 * The YouTube variant PREVIEWS the video as soon as the URL parses. Pasting a
 * share link is exactly where a wrong clipboard goes unnoticed, and a preview
 * is the cheapest possible confirmation — you see the video you are about to
 * insert before you insert it. The insert action stays disabled until the URL
 * resolves to a video, so a mistyped link cannot be committed.
 */
export function UrlSheet() {
  const open = useUrlStore((state) => state.open);
  const kind = useUrlStore((state) => state.kind);
  const resolve = useUrlStore((state) => state.resolve);

  const draft = useMemo(() => createDraftStore(), []);
  const value = useStore(draft, (state) => state.value);

  const isYouTube = kind === "youtube";
  const videoId = isYouTube ? youTubeVideoId(value) : null;
  const canInsert = isYouTube ? videoId !== null : value.trim().length > 0;

  const close = (url: string | null) => {
    draft?.getState().set("");
    resolve(url);
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => close(null)}
    >
      {/*
        The library's KeyboardAvoidingView, never React Native's: RN's relies on
        LayoutAnimation and the late keyboardDidShow, so Android snaps instead
        of tracking the keyboard curve. Without it the Insert and Cancel buttons
        sit BEHIND the keyboard the moment the field is focused — the dialog is
        centred, and the keyboard takes the lower half of the screen.
      */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center bg-ink-950/40 p-6">
          <View className="w-full max-w-md gap-4 overflow-hidden rounded-card border-2 border-border bg-surface-raised p-5 shadow-overlay">
            <View className="flex-row items-center gap-2">
              {isYouTube ? (
                <Video size={20} className="text-accent" />
              ) : (
                <LinkIcon size={20} className="text-accent" />
              )}
              <Text className="flex-1 text-lg font-semibold text-text md:text-xl">
                {isYouTube ? "YouTube video" : "Add a link"}
              </Text>
              <Pressable
                aria-label="Close"
                onPress={() => close(null)}
                className="h-11 w-11 items-center justify-center rounded-md border-2 border-border bg-surface transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
              >
                <X size={18} className="text-text-muted" />
              </Pressable>
            </View>

            <TextField
              label={isYouTube ? "Video URL" : "URL"}
              value={value}
              onChangeText={(next) => draft?.getState().set(next)}
              placeholder={isYouTube ? "https://youtu.be/…" : "https://…"}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canInsert) close(value.trim());
              }}
            />

            {/* Only once it parses — a preview slot that sits empty while typing
              would jump the dialog's height on every keystroke. */}
            {isYouTube && videoId !== null ? (
              <YouTubeEmbed
                videoId={videoId}
                className="my-0 w-full self-stretch"
              />
            ) : null}

            {isYouTube && value.trim().length > 0 && videoId === null ? (
              <Text className="text-sm text-danger">
                That does not look like a YouTube link. Paste a watch, share or
                Shorts URL.
              </Text>
            ) : null}

            <View className="flex-row justify-end gap-3">
              <Button
                variant="outline"
                title="Cancel"
                onPress={() => close(null)}
              />
              <Button
                variant="primary"
                title="Insert"
                disabled={!canInsert}
                onPress={() => close(value.trim())}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
