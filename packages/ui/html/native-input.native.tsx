'use client';
import { useEffect } from 'react';
import { Div } from '@expo/html-elements';
import { Host, TextInput as BaseExpoTextInput, useNativeState } from '@expo/ui';
import { css } from './css';

/**
 * `css` is Uniwind's `withUniwind`. Wrapping the native field in it is what
 * lets a className reach a control that is not a React Native view; the kit's
 * helper types the wrapper as accepting `className` (mapped to the component's
 * `style`), while the field's TEXT colour and size are lifted from the already
 * resolved style by `toNativeInputProps` — `textStyle` is a separate prop that
 * the helper's type surface does not expose a className for.
 */
const ExpoTextInput = css(BaseExpoTextInput, 'ExpoTextInput');

/**
 * The kit's own field contract. Deliberately NOT React Native's `TextInput`
 * props: those describe an RN view whose event objects and style surface do not
 * exist here, and borrowing them would promise behaviour this control cannot
 * honour.
 */
export interface NativeInputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  multiline?: boolean;
  numberOfLines?: number;
  'aria-label'?: string;
  /** Resolved text values, lifted from the wrapper's already-resolved style. */
  color?: string;
  fontSize?: number;
  /**
   * The rest of the resolved className style, applied to the Host. Without it
   * the Host sizes to its content, so a field with `flex-1` does not fill its
   * row and everything after it — a clear button, a trailing icon — collapses
   * inward instead of sitting at the trailing edge.
   */
  containerStyle?: Record<string, unknown>;
}

/**
 * The kit's text editing surface, rendered by `@expo/ui`.
 *
 * `@expo/ui`'s UNIVERSAL `TextInput` — one import backed by SwiftUI on iOS and
 * Jetpack Compose on Android — rather than React Native's `TextInput`, so the
 * kit is native controls end to end like the rest of it (Switch, Checkbox,
 * BottomSheet, Picker).
 *
 * `useNativeState` is not optional here. A native control owns its own text;
 * handing it a plain controlled `value` makes JS and the native view fight over
 * every keystroke. `ObservableState` is the shared cell both sides read and
 * write, which is why the universal `TextInput` types `value` as one.
 *
 * Chrome stays in JS. `@expo/ui` cannot take a className for its own text, so
 * the border, radius, shadow and padding remain the kit's classNames on the
 * wrapper, and only resolved values (colour, size) cross into the native view.
 */
export function NativeInput({
  value,
  onChangeText,
  onFocus,
  onBlur,
  onSubmitEditing,
  placeholder,
  placeholderTextColor,
  secureTextEntry,
  editable,
  returnKeyType,
  multiline,
  numberOfLines,
  'aria-label': ariaLabel,
  color,
  fontSize,
  containerStyle,
}: NativeInputProps) {
  const state = useNativeState(value ?? '');

  // Adopt external changes — a parent clearing a query, a form reset. Compared
  // first so a JS write never echoes back over text the user is mid-way through
  // typing; writes from JS reach the UI thread asynchronously.
  useEffect(() => {
    // `.value` rather than get()/set(): those exist only on the native builds,
    // while the type the compiler resolves is the web polyfill's `{ value }`.
    //
    // `useNativeState` IS a mutable two-way binding to the native view, so
    // assigning to `.value` is its documented write path rather than an
    // accidental mutation of React-owned state. The directive has to sit on the
    // line immediately before the statement to apply.
    // eslint-disable-next-line react-hooks/immutability
    if (value !== undefined && state.value !== value) state.value = value;
  }, [value, state]);

  return (
    /*
      CHROME ON THE WRAPPER, TEXT IN THE NATIVE VIEW.

      The border, radius, background and padding cannot live on the Host: with
      `matchContents.vertical` the Host measures the NATIVE text and collapses
      to its line height, so the padding is swallowed and the border ends up
      hugging the glyphs — a thin outline with the caret sitting on the frame,
      next to controls that are all chunky slabs.

      So the resolved className style dresses a plain View, and the Host inside
      carries nothing but the editing surface. matchContents stays per-axis:
      vertical so the field is as tall as its text, horizontal off so it fills
      the width the wrapper gives it.
    */
    <Div style={containerStyle as never}>
      <Host matchContents={{ vertical: true, horizontal: false }}>
        <ExpoTextInput
          value={state}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={onSubmitEditing ? () => onSubmitEditing() : undefined}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          secureTextEntry={secureTextEntry}
          editable={editable}
          returnKeyType={returnKeyType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          testID={ariaLabel}
          textStyle={{ color, fontSize }}
        />
      </Host>
    </Div>
  );
}
