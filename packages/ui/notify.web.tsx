'use client';
// PLATFORM FORK — sonner (DOM). Same card, same call surface; only the queue,
// positioning and motion differ, because sonner-native cannot run on the web.
import { Toaster as SonnerToaster, toast as sonner } from 'sonner';
import { ToastCard } from './ToastCard';
import {
  dismissibleFor, durationFor, nextToastId,
  type NotifyOptions, type NotifyVariant,
} from './notify.shared';

function show(variant: NotifyVariant, title: string, options: NotifyOptions = {}) {
  const id = options.id ?? nextToastId();
  return sonner.custom(
    () => (
      <ToastCard
        variant={variant}
        title={title}
        description={options.description}
        action={options.action}
        onDismiss={dismissibleFor(variant, options.dismissible)
          ? () => sonner.dismiss(id)
          : undefined}
      />
    ),
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

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={12}
      gap={10}
      visibleToasts={3}
      // Our card carries the whole design; sonner's default styling would
      // double the border and background behind it.
      toastOptions={{ unstyled: true, classNames: { toast: 'w-full' } }}
    />
  );
}
