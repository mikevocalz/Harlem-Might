'use client';

import { BottomSheet } from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Trash2, Copy, Calendar } from '@acme/ui/icons';

export interface EventActionsSheetProps {
  open: boolean;
  onClose: () => void;
  eventTitle: string;
  onDuplicate: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}

/** Contextual actions presented by Expo UI's universal native sheet. */
export function EventActionsSheet({
  open,
  onClose,
  eventTitle,
  onDuplicate,
  onReschedule,
  onDelete,
}: EventActionsSheetProps) {
  const actions = [
    { label: 'Duplicate', icon: Copy, onPress: onDuplicate, danger: false },
    { label: 'Reschedule', icon: Calendar, onPress: onReschedule, danger: false },
    { label: 'Delete', icon: Trash2, onPress: onDelete, danger: true },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title={eventTitle}>
      <View className="gap-3 py-2">
        {actions.map((action) => (
          <Pressable
            key={action.label}
            aria-label={action.label}
            onPress={() => {
              action.onPress();
              onClose();
            }}
            className={`min-h-11 flex-row items-center gap-3 rounded-md border-2 border-border px-4 py-3 transition-colors duration-fast motion-reduce:transition-none ${
              action.danger
                ? 'bg-surface-raised hover:bg-danger/10 active:bg-danger/10'
                : 'bg-surface-raised hover:bg-surface-sunken active:bg-surface-sunken'
            }`}
          >
            <action.icon
              size={18}
              className={action.danger ? 'text-danger' : 'text-text-muted'}
            />
            <Text
              className={`text-base font-medium ${
                action.danger ? 'text-danger' : 'text-text'
              }`}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
