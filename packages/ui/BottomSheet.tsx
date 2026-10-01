'use client';
import { tv } from 'tailwind-variants';
import { BottomSheet as ExpoBottomSheet } from '@expo/ui';
import { ScrollView, View, Text, Pressable } from './tw';

// Expo UI's universal sheet: vaul on web (real drag physics), SwiftUI /
// Material sheets on native. Two snap points — 55% and 85%, never full
// screen — driven by dragging the grabber.
const SNAP_POINTS = [{ fraction: 0.55 }, { fraction: 0.85 }];

const sheet = tv({
  slots: {
    content: 'h-full flex-1 rounded-t-sheet bg-surface-raised px-4 pb-6',
    header: 'mb-3 flex-row items-center justify-between gap-3',
    title: 'flex-1 font-display text-xl font-semibold text-text',
    close: 'rounded-md bg-surface-sunken p-2 active:opacity-70',
  },
});

export interface SheetSurfaceProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

/**
 * The presentational sheet surface — exported separately so it can render
 * inline (e.g. in Storybook) without the sheet portal.
 */
export function SheetSurface({ title, children, className, onClose }: SheetSurfaceProps) {
  const s = sheet();
  return (
    <View role="dialog" aria-label={title} className={s.content({ className })}>
      <View className={s.header()}>
        <Text className={s.title()}>{title ?? ''}</Text>
        {onClose ? (
          <Pressable onPress={onClose} accessibilityLabel="Close" role="button" className={s.close()}>
            <Text className="text-base leading-none text-text">✕</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-2"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export interface BottomSheetProps extends SheetSurfaceProps {
  open: boolean;
  onClose: () => void;
}

export function BottomSheet({ open, onClose, ...surfaceProps }: BottomSheetProps) {
  return (
    <ExpoBottomSheet isPresented={open} onDismiss={onClose} snapPoints={SNAP_POINTS}>
      <SheetSurface {...surfaceProps} onClose={onClose} />
    </ExpoBottomSheet>
  );
}
