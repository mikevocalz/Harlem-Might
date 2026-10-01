'use client';
// PLATFORM FORK — sonner-native (Reanimated + Gesture Handler).
import { Toaster as SonnerToaster, toast as sonner } from 'sonner-native';
import { ToastCard } from './ToastCard';
import {
  dismissibleFor, durationFor, nextToastId,
  type NotifyOptions, type NotifyVariant,
} from './notify.shared';

function show(variant: NotifyVariant, title: string, options: NotifyOptions = {}) {
  const id = options.id ?? nextToastId();
  return sonner.custom(
    <ToastCard
      variant={variant}
      title={title}
      description={options.description}
      action={options.action}
      onDismiss={dismissibleFor(variant, options.dismissible)
        ? () => sonner.dismiss(id)
        : undefined}
    />,
    { id, duration: durationFor(variant, options.duration) },
  );
}

export const notify = {
  info: (title: string, options?: NotifyOptions) => show('info', title, options),
  success: (title: string, options?: NotifyOptions) => show('success', title, options),
  warning: (title: string, options?: NotifyOptions) => show('warning', title, options),
  error: (title: string, options?: NotifyOptions) => show('error', title, options),
  loading: (title: string, options?: NotifyOptions) => show('loading', title, options),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

/**
 * Mount once, at the app root, INSIDE the gesture handler and safe-area
 * providers — sonner-native's swipe-to-dismiss and top offset need both.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={12}
      gap={10}
      visibleToasts={3}
      swipeToDismissDirection="up"
      // The card IS the toast. Without this the library's own padded,
      // rounded container sits behind ours and shows as a pale halo.
      toastOptions={{ unstyled: true, style: { backgroundColor: 'transparent' } }}
    />
  );
}
