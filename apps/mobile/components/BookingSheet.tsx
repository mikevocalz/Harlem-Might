'use client';

import { BottomSheet } from '@acme/ui';
import { useRouter } from 'expo-router';
import { BookingForm, useScheduleStore } from '@acme/app';

/**
 * New-booking sheet backed by Expo UI's universal sheet.
 * SwiftUI / Material own the native presentation while the same component
 * keeps a web implementation, eliminating the former Gorhom-only fork.
 */
export function BookingSheet() {
  const router = useRouter();
  const bookingOpen = useScheduleStore((state) => state.bookingOpen);
  const closeBooking = useScheduleStore((state) => state.closeBooking);

  return (
    <BottomSheet open={bookingOpen} onClose={closeBooking} title="New booking">
      <BookingForm
        onDone={closeBooking}
        onOpenEditorSettings={() => {
          closeBooking();
          router.push('/editor-settings');
        }}
      />
    </BottomSheet>
  );
}
