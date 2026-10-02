'use client';
/**
 * PLATFORM FORK — justification (§7): native counterparts of the web-only
 * semantic tags and interactive controls. The platform's real controls
 * (Pressable, TextInput) live ONLY in this fork — nothing outside dom.native
 * imports them from react-native. Details renders resolved (open) —
 * interactive disclosure is a composed component, not a primitive.
 * Styling is applied by the css() shim callers.
 */
import React from 'react';
import { Children, isValidElement } from 'react';
import { Pressable, StyleSheet, type TextInputProps } from 'react-native';
import { Div, Span } from '@expo/html-elements';
import { Host, Picker } from '@expo/ui';
import { NativeInput, type NativeInputProps } from './native-input.native';

type P = { children?: React.ReactNode };

export const FigcaptionBase = (props: P) => <Span {...props} />;
export const AddressBase = (props: P) => <Div {...props} />;
export const DetailsBase = ({ open: _open, ...props }: P & { open?: boolean }) => (
  <Div {...props} />
);
export const SummaryBase = (props: P) => <Span {...props} />;
export const FieldsetBase = (props: P & { disabled?: boolean }) => <Div {...props} />;
export const LegendBase = (props: P) => <Span {...props} />;
/**
 * Native select, rendered by `@expo/ui`'s universal Picker.
 *
 * This previously rendered a `View` with a `Text` inside and DISCARDED
 * `onValueChange`, so on native it was a label shaped like a control: it could
 * not be opened and could never change its value. The Picker is the platform's
 * real one — a menu on both targets — so the control works and looks native.
 *
 * Options come from `<option>` children so the same JSX serves the web fork's
 * real `<select>`; they are read here and re-emitted as `Picker.Item`.
 */
export const SelectBase = (
  props: P & {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
  },
) => {
  const { value, onValueChange, disabled, children, ...rest } = props;

  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; children?: React.ReactNode }>(child)) return [];
    const optionValue = child.props.value;
    if (typeof optionValue !== 'string') return [];
    const label = typeof child.props.children === 'string' ? child.props.children : optionValue;
    return [{ value: optionValue, label }];
  });

  return (
    <Div {...rest}>
      <Host matchContents>
        <Picker
          selectedValue={value ?? options[0]?.value ?? ''}
          onValueChange={(next: string) => {
            if (!disabled) onValueChange?.(next);
          }}
        >
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </Host>
    </Div>
  );
};

export type PressBaseProps = React.ComponentProps<typeof Pressable> & {
  /** Web-only; accepted here so one JSX tree serves both forks. */
  onKeyDown?: (event: unknown) => void;
};

export const PressBase = ({ role, onKeyDown: _onKeyDown, ...props }: PressBaseProps) => (
  <Pressable {...props} />
);

export const ButtonBase = ({ role, onKeyDown: _onKeyDown, ...props }: PressBaseProps) => (
  <Pressable role={(role ?? 'button') as never} {...props} />
);

export type InputBaseProps = TextInputProps;

/**
 * Text fields render through `@expo/ui`'s universal TextInput (SwiftUI /
 * Jetpack Compose) rather than React Native's, so the kit is native controls
 * end to end. See `native-input.native.tsx` for why `useNativeState` is
 * required rather than a plain controlled value.
 */
export const InputBase = ({ style, ...props }: InputBaseProps) => (
  <NativeInput {...toNativeInputProps(props, style)} />
);

export const TextareaBase = ({ style, ...props }: InputBaseProps) => (
  <NativeInput
    {...toNativeInputProps(props, style)}
    multiline
    numberOfLines={props.numberOfLines ?? 4}
  />
);

/**
 * Narrow RN's TextInput props to the slice the native control accepts.
 *
 * A native view cannot consume a className, but it does not have to: the kit's
 * `css()` wrapper (Uniwind's `withUniwind`) has already resolved the classes
 * into a style object by the time this runs, so the text properties are lifted
 * out of it and passed as values. That is what keeps `text-base text-text`
 * working on a field that is no longer a React Native TextInput.
 */
function toNativeInputProps(
  props: InputBaseProps,
  style: InputBaseProps['style'],
): NativeInputProps {
  const flat = StyleSheet.flatten(style) ?? {};
  // Text properties go to the native field; everything else (flex, width,
  // alignment) describes the box and belongs on the Host.
  const { color: _c, fontSize: _f, ...containerStyle } = flat as Record<string, unknown>;
  return {
    color: typeof flat.color === 'string' ? flat.color : undefined,
    fontSize: typeof flat.fontSize === 'number' ? flat.fontSize : undefined,
    containerStyle,
    value: typeof props.value === 'string' ? props.value : undefined,
    onChangeText: props.onChangeText,
    onFocus: props.onFocus ? () => props.onFocus?.(undefined as never) : undefined,
    onBlur: props.onBlur ? () => props.onBlur?.(undefined as never) : undefined,
    onSubmitEditing: props.onSubmitEditing
      ? () => props.onSubmitEditing?.(undefined as never)
      : undefined,
    placeholder: props.placeholder,
    placeholderTextColor:
      typeof props.placeholderTextColor === 'string' ? props.placeholderTextColor : undefined,
    secureTextEntry: props.secureTextEntry,
    editable: props.editable,
    returnKeyType: props.returnKeyType as NativeInputProps['returnKeyType'],
    'aria-label': typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined,
  };
}

export const LabelBase = (props: P) => <Span role={'label' as never} {...props} />;
export const FormBase = (props: P) => <Div role="form" {...props} />;


export const DocumentHtmlBase = ({ children }: P) => <>{children}</>;
export const DocumentHeadBase = ({ children }: P) => <>{children}</>;
export const DocumentBodyBase = ({ children }: P) => <>{children}</>;


/**
 * Type-compatible native fallback for the semantic GPU surface. Spatial
 * renderers use react-native-webgpu's Canvas directly on native; this keeps
 * feature code from ever inventing a raw web canvas.
 */
export const GpuCanvasBase = (props: P) => <Div {...props} />;
