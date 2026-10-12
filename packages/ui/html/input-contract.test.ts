/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import ts from 'typescript';
import type { InputBaseProps } from './dom.native';
import type { NativeInputProps } from './native-input.native';

const nativeUrl = new URL('./dom.native.tsx', import.meta.url).href;
const fieldUrl = new URL('./native-input.native.tsx', import.meta.url).href;
const cssUrl = new URL('./css.native.tsx', import.meta.url).href;
const webUrl = new URL('./dom.web.tsx', import.meta.url).href;
const sources = [nativeUrl, fieldUrl, cssUrl, webUrl];

// Execute the production adapters and native field. Only platform/library leaves
// are inert: no device runtime is available in this Node regression suite.
const leaves: Record<string, string> = {
  'react-native': `
    export const Pressable = 'Pressable';
    function flatten(style) {
      if (!style || typeof style !== 'object') return undefined;
      return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style;
    }
    export const StyleSheet = { flatten };
  `,
  '@expo/html-elements': `export const Div = 'Div'; export const Span = 'Span';`,
  '@expo/ui': `
    export const Host = 'Host';
    export const Picker = Object.assign(() => null, { Item: 'Picker.Item' });
    export function TextInput() { return null; }
    export const useNativeState = value => ({ value });
  `,
  uniwind: `export const withUniwind = Component => Component;`,
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL && sources.includes(context.parentURL)) {
      if (specifier in leaves) return { url: `input-contract:${specifier}`, shortCircuit: true };
      if (specifier === './native-input.native') return next(fieldUrl, context);
      if (specifier === './css') return next(cssUrl, context);
      if (specifier === 'react' && context.parentURL === fieldUrl) {
        return { url: 'input-contract:react-effects', shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'input-contract:react-effects') {
      return { format: 'module', source: 'export const useEffect = effect => effect();', shortCircuit: true };
    }
    if (url.startsWith('input-contract:')) {
      return { format: 'module', source: leaves[url.slice('input-contract:'.length)]!, shortCircuit: true };
    }
    if (sources.includes(url)) {
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(
        readFileSync(new URL(url), 'utf8'),
        { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } },
      ).outputText };
    }
    return next(url, context);
  },
});
const native = await import(nativeUrl) as typeof import('./dom.native');
const { NativeInput } = await import(fieldUrl) as typeof import('./native-input.native');
const web = await import(webUrl) as typeof import('./dom.web');
hooks.deregister();

type Element = ReactElement<{ children: Element; [key: string]: unknown }>;
function fieldProps(element: ReactElement<NativeInputProps>) {
  assert.equal(element.type, NativeInput);
  return element.props;
}
function expoProps(props: NativeInputProps) {
  const wrapper = NativeInput(props) as Element;
  assert.equal(wrapper.type, 'Div');
  const host = wrapper.props.children;
  assert.equal(host.type, 'Host');
  assert.deepEqual(host.props.matchContents, { vertical: true, horizontal: false });
  const field = host.props.children;
  assert.equal(typeof field.type, 'function');
  assert.equal((field.type as { displayName?: string }).displayName, 'CSS(ExpoTextInput)');
  return field.props;
}

for (const [name, render] of [['InputBase', native.InputBase], ['TextareaBase', native.TextareaBase]] as const) {
  test(`${name} forwards callbacks unchanged and native callbacks never receive fake events`, () => {
    const received: unknown[][] = [];
    const onFocus = (...args: unknown[]) => { received.push(args); };
    const onBlur = (...args: unknown[]) => { received.push(args); };
    const onSubmitEditing = (...args: unknown[]) => { received.push(args); };
    const changes: string[] = [];
    const onChangeText = (text: string) => { changes.push(text); };
    const props = fieldProps(render({ onFocus, onBlur, onSubmitEditing, onChangeText }));
    const field = expoProps(props);
    (field.onFocus as () => void)();
    (field.onBlur as () => void)();
    (field.onSubmitEditing as (text: string) => void)('current text from Expo');
    (field.onChangeText as (text: string) => void)('new text');
    assert.deepEqual(received, [[], [], []]);
    assert.deepEqual(changes, ['new text']);
    assert.equal(props.onFocus, onFocus);
    assert.equal(props.onBlur, onBlur);
    assert.equal(props.onSubmitEditing, onSubmitEditing);
    assert.equal(props.onChangeText, onChangeText);
  });

  test(`${name} preserves resolved styles and the supported native props`, () => {
    const style: InputBaseProps['style'] = [
      { flex: 1, color: '#111', fontSize: 14, padding: 8, borderWidth: 2 },
      null, false, [{ color: '#222', fontSize: 16 }],
    ];
    const props = fieldProps(render({
      style, value: '', placeholder: 'Search Harlem', placeholderTextColor: '#888',
      secureTextEntry: true, editable: false, returnKeyType: 'search', 'aria-label': 'Search',
    }));
    assert.equal(props.color, '#222');
    assert.equal(props.fontSize, 16);
    assert.deepEqual(props.containerStyle, { flex: 1, padding: 8, borderWidth: 2 });
    const field = expoProps(props);
    assert.deepEqual(field.value, { value: '' });
    assert.equal(field.placeholder, 'Search Harlem');
    assert.equal(field.placeholderTextColor, '#888');
    assert.equal(field.secureTextEntry, true);
    assert.equal(field.editable, false);
    assert.equal(field.returnKeyType, 'search');
    assert.equal(field.testID, 'Search');
    assert.deepEqual(field.textStyle, { color: '#222', fontSize: 16 });
  });

  test(`${name} keeps absent callbacks absent`, () => {
    const props = fieldProps(render({}));
    const field = expoProps(props);
    for (const key of ['onFocus', 'onBlur', 'onSubmitEditing', 'onChangeText']) {
      assert.equal(field[key], undefined);
    }
    assert.deepEqual(props.containerStyle, {});
  });
}

test('TextareaBase keeps its default and explicit native line counts', () => {
  for (const [input, expected] of [[{}, 4], [{ numberOfLines: 7 }, 7]] as const) {
    const field = expoProps(fieldProps(native.TextareaBase(input)));
    assert.equal(field.multiline, true);
    assert.equal(field.numberOfLines, expected);
  }
  const input = expoProps(fieldProps(native.InputBase({})));
  assert.equal(input.multiline, undefined);
});

test('the web input still uses DOM text changes, focus handlers and Enter-only submission', () => {
  const submitted: unknown[][] = [];
  const changes: string[] = [];
  const onFocus = () => {};
  const onBlur = () => {};
  const input = web.InputBase({
    onFocus, onBlur, onSubmitEditing: (...args: unknown[]) => { submitted.push(args); },
    onChangeText: text => { changes.push(text); }, secureTextEntry: true,
    editable: false, returnKeyType: 'done', autoComplete: 'current-password',
  });
  assert.equal(input.type, 'input');
  assert.equal(input.props.onFocus, onFocus);
  assert.equal(input.props.onBlur, onBlur);
  assert.equal(input.props.type, 'password');
  assert.equal(input.props.readOnly, true);
  assert.equal(input.props.enterKeyHint, 'done');
  assert.equal(input.props.autoComplete, 'current-password');
  input.props.onChange({ target: { value: 'new text' } });
  input.props.onKeyDown({ key: 'Escape' });
  input.props.onKeyDown({ key: 'Enter' });
  assert.deepEqual(changes, ['new text']);
  assert.deepEqual(submitted, [[]]);
});

test('native consumer types reject nonexistent RN event arguments through public wrappers', () => {
  const program = ts.createProgram({
    rootNames: [fileURLToPath(new URL('./__typechecks__/input-callbacks.native.tsx', import.meta.url))],
    options: {
      strict: true, noEmit: true, skipLibCheck: true, types: [],
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022,
      moduleSuffixes: ['.native', ''], allowImportingTsExtensions: true,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
  });
  assert.equal(diagnostics.length, 0, formatted);
});
