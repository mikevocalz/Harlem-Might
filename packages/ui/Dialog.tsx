'use client';
import { tv } from 'tailwind-variants';
import { Modal } from 'react-native';
import { View, Text, Pressable } from './tw';
import { ScaleIn } from './motion';

const dialog = tv({
  slots: {
    // Modal content is portal-rendered; the wrapper centers the surface.
    wrapper: 'flex-1 items-center justify-center p-6',
    scrim: 'absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]',
    card: 'w-full max-w-content-form rounded-sheet border-2 border-border bg-surface-raised p-6 shadow-overlay',
    title: 'font-display text-xl font-semibold text-text',
    description: 'mt-2 text-base text-text-muted',
    body: 'mt-4',
    actions: 'mt-6 flex-row items-center justify-end gap-3',
  },
});

export interface DialogCardProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The presentational dialog surface — exported separately so it can render
 * inline (e.g. in Storybook) without the RN Modal portal.
 */
export function DialogCard({ title, description, children, actions, className }: DialogCardProps) {
  const s = dialog();
  return (
    <ScaleIn role="dialog" aria-modal aria-label={title} className={s.card({ className })}>
      <Text className={s.title()}>{title}</Text>
      {description ? <Text className={s.description()}>{description}</Text> : null}
      {children ? <View className={s.body()}>{children}</View> : null}
      {actions ? <View className={s.actions()}>{actions}</View> : null}
    </ScaleIn>
  );
}

export interface DialogProps extends DialogCardProps {
  open: boolean;
  onClose: () => void;
}

export function Dialog({ open, onClose, ...cardProps }: DialogProps) {
  const s = dialog();
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View className={s.wrapper()}>
        <Pressable aria-label="Close dialog" onPress={onClose} className={s.scrim()} />
        <DialogCard {...cardProps} />
      </View>
    </Modal>
  );
}
