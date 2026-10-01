export type NotifyVariant = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface NotifyOptions {
  description?: string;
  /** One action, right-aligned. Two competing actions belong in a dialog. */
  action?: { label: string; onPress: () => void };
  /** ms. `loading` ignores this — it stays until you resolve or dismiss it. */
  duration?: number;
  /** Pass to update an existing toast in place rather than stacking a new one. */
  id?: string | number;
  /** Adds an explicit close control. On by default for error and loading. */
  dismissible?: boolean;
}

/** Long enough to read a sentence, short enough not to sit in the way. */
export const DEFAULT_DURATION = 4000;
export const ERROR_DURATION = 6000;

let sequence = 0;
/**
 * The id is generated HERE rather than taken from the toaster's return value,
 * because the card needs to dismiss itself and therefore has to close over its
 * own id — which does not exist yet at the moment the JSX is built.
 */
export function nextToastId(): string {
  sequence += 1;
  return `toast-${sequence}`;
}

export function durationFor(variant: NotifyVariant, requested?: number): number | undefined {
  if (requested !== undefined) return requested;
  // A spinner that vanishes on a timer tells the user the work finished when
  // it has not. Loading toasts are closed by whoever opened them.
  if (variant === 'loading') return Infinity;
  return variant === 'error' ? ERROR_DURATION : DEFAULT_DURATION;
}

export function dismissibleFor(variant: NotifyVariant, requested?: boolean): boolean {
  if (requested !== undefined) return requested;
  return variant === 'error' || variant === 'loading';
}
