import type { ComponentProps } from 'react';
import type { TextInputProps } from 'react-native';
import { Input, Textarea } from '../index';
import { TextInput } from '../../tw';
import { InputBase, TextareaBase, type InputBaseProps } from '../dom.native';
import type { NativeInputProps } from '../native-input.native';

type Callback = 'onFocus' | 'onBlur' | 'onSubmitEditing';
type Assert<T extends true> = T;
type HasNoEvent<P extends Pick<NativeInputProps, Callback>> = {
  [K in Callback]: Parameters<NonNullable<P[K]>> extends [] ? true : false;
}[Callback];

// These assertions also guard the public css()/primitive wrapper's inferred props.
export type NativeCallbacksHaveNoEvent = Assert<HasNoEvent<InputBaseProps>>;
export type PublicInputCallbacksHaveNoEvent = Assert<HasNoEvent<ComponentProps<typeof Input>>>;
export type TwInputCallbacksHaveNoEvent = Assert<HasNoEvent<ComponentProps<typeof TextInput>>>;
export type PublicTextareaCallbacksHaveNoEvent = Assert<HasNoEvent<ComponentProps<typeof Textarea>>>;

const onFocus = () => {};
const onBlur = () => {};
const onSubmitEditing = () => {};
const onChangeText = (_value: string) => {};

// SearchBar's gesture callbacks and keyboard submit, plus its resolved style.
export const search = <Input role="searchbox" aria-label="Search" value="Harlem"
  onFocus={onFocus} onBlur={onBlur} onSubmitEditing={onSubmitEditing}
  onChangeText={onChangeText} returnKeyType="search" className="flex-1 text-base"
  style={[{ flex: 1 }, { color: '#222', fontSize: 16 }]} />;

// The tw entry point used by both Explore master-pane implementations.
export const explore = <TextInput aria-label="Search places" value="Apollo"
  onChangeText={onChangeText} onFocus={onFocus} onSubmitEditing={onSubmitEditing}
  returnKeyType="search" placeholder="Search places" className="flex-1" />;

// Storybook's uncontrolled-field props remain accepted.
export const defaultName = <Input defaultValue="Maya Rodriguez" />;

// Shared auth props and the field/form wrappers' existing blur and error props.
export const email = <Input aria-label="Email" aria-invalid={false} value=""
  autoComplete="email" autoCapitalize="none" inputMode="email" editable
  onChangeText={onChangeText} onBlur={onBlur} />;
export const password = <InputBase value="" secureTextEntry autoComplete="current-password"
  placeholder="Password" placeholderTextColor="#888" returnKeyType="done"
  onSubmitEditing={onSubmitEditing} />;
export const notes = <Textarea aria-label="Notes" aria-invalid={false} value=""
  numberOfLines={6} editable={false} className="min-h-24" onBlur={onBlur}
  onChangeText={onChangeText} />;
export const baseNotes = <TextareaBase onFocus={onFocus} onBlur={onBlur}
  onSubmitEditing={onSubmitEditing} numberOfLines={3} />;

const rnFocus: NonNullable<TextInputProps['onFocus']> = (event) => { void event.nativeEvent; };
const rnBlur: NonNullable<TextInputProps['onBlur']> = (event) => { void event.nativeEvent; };
const rnSubmit: NonNullable<TextInputProps['onSubmitEditing']> = (event) => { void event.nativeEvent.text; };

// A real RN event handler must not type-check against a control that has no event.
// @ts-expect-error Native focus does not provide a React Native event.
export const invalidFocus = <InputBase onFocus={rnFocus} />;
// @ts-expect-error Native blur does not provide a React Native event.
export const invalidBlur = <TextareaBase onBlur={rnBlur} />;
// @ts-expect-error Native submit does not provide a React Native event.
export const invalidSubmit = <InputBase onSubmitEditing={rnSubmit} />;
// @ts-expect-error The public styling wrapper must retain the native contract.
export const invalidPublicFocus = <Input onFocus={rnFocus} />;
// @ts-expect-error The public textarea must retain the native contract.
export const invalidPublicBlur = <Textarea onBlur={rnBlur} />;
// @ts-expect-error The tw entry point must retain the native submit contract.
export const invalidTwSubmit = <TextInput onSubmitEditing={rnSubmit} />;
// @ts-expect-error NativeInput intentionally normalizes Expo's text-bearing submit callback.
export const invalidSubmitText = <Textarea onSubmitEditing={(_text: string) => {}} />;

// @ts-expect-error Contextual focus handlers cannot require an event, either.
export const invalidContextualFocus = <Input onFocus={(event) => { void event.nativeEvent; }} />;

// The facade must not silently accept unsupported React Native options.
// @ts-expect-error NativeInput has no RN key-press event bridge.
export const invalidKeyPress = <Input onKeyPress={() => {}} />;
// @ts-expect-error Selection control is not exposed by the portable adapter.
export const invalidSelection = <TextInput selection={{ start: 0, end: 1 }} />;
// @ts-expect-error Use the portable inputMode rather than an unimplemented RN keyboard option.
export const invalidKeyboardType = <Input keyboardType="email-address" />;
