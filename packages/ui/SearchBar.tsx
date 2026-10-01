'use client';
import { useEffect } from 'react';
import { tv } from 'tailwind-variants';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { useInstanceStore, useStore } from './use-instance-store';
import { View, Text, Pressable } from './tw';
import { X } from './icons';
import { Input } from './primitives';

const searchBar = tv({
  slots: {
    root:
      'flex-row items-center gap-2 rounded-lg border-2 border-border bg-surface-raised px-4 py-2.5 ' +
      'transition-all duration-fast hover:border-border-strong ' +
      'focus-within:shadow-card ' +
      'motion-reduce:transition-none',
    glyph: 'text-base text-text-muted',
    input: 'flex-1 p-0 text-base text-text placeholder:text-text-muted/70 focus:outline-none',
    clear:
      'h-6 w-6 items-center justify-center rounded-full transition-colors duration-fast ' +
      'hover:bg-surface-sunken active:opacity-80 motion-reduce:transition-none',
  },
});

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  /**
   * Debounce upstream onChangeText by this many ms (@tanstack/react-pacer).
   * The field itself always echoes keystrokes instantly.
   */
  debounceMs?: number;
  'aria-label'?: string;
  className?: string;
  /** Focus callbacks — consumers gate competing gestures on these. */
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchBar({
  value, onChangeText, placeholder, onSubmit, debounceMs, className, onFocus, onBlur,
  'aria-label': ariaLabel = 'Search',
}: SearchBarProps) {
  const s = searchBar();

  // Instant local echo (zustand — repo rule) with debounced upstream delivery.
  const echo = useInstanceStore<{ text: string; external: string }>(() => ({
    text: value,
    external: value,
  }));
  const text = useStore(echo, (st) => st.text);
  // Adopt external value changes (e.g. parent cleared the query).
  useEffect(() => {
    if (debounceMs && value !== echo.getState().external) {
      echo.setState({ text: value, external: value });
    }
  }, [value, debounceMs, echo]);

  const debounced = useDebouncedCallback(
    (next: string) => onChangeText(next),
    { wait: debounceMs ?? 0, enabled: !!debounceMs },
  );

  const shownValue = debounceMs ? text : value;
  const handleChange = (next: string) => {
    if (debounceMs) {
      echo.setState({ text: next });
      debounced(next);
    } else {
      onChangeText(next);
    }
  };
  const clear = () => {
    if (debounceMs) echo.setState({ text: '', external: '' });
    onChangeText('');
  };

  return (
    <View className={s.root({ className })}>
      <Text aria-hidden className={s.glyph()}>🔍</Text>
      <Input
        role="searchbox"
        aria-label={ariaLabel}
        value={shownValue}
        onChangeText={handleChange}
        placeholder={placeholder}
        onSubmitEditing={onSubmit}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
        className={s.input()}
      />
      {shownValue ? (
        <Pressable
          role="button"
          aria-label="Clear search"
          onPress={clear}
          className={s.clear()}
        >
          {/* The ✕ character rendered at the font's own hairline weight, which
              read as stray punctuation rather than a control. A lucide X with a
              heavier stroke matches the weight of every other icon in the kit. */}
          <X size={16} strokeWidth={2.5} className="text-text-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}
