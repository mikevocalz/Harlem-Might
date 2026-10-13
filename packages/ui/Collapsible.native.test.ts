/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';

const source = (path: string) => new URL(path, import.meta.url).href;
const collapsibleUrl = source('./Collapsible.native.tsx');
const twUrl = source('./tw.tsx');
const cssUrl = source('./html/css.native.tsx');
const listUrl = source('./List.native.tsx');
const slotUrl = source('./NativeSlot.native.tsx');
const sources = [collapsibleUrl, twUrl, cssUrl, listUrl, slotUrl];
// Load the installed, pinned native HOC, not a copy of its className mapping.
const uniwindUrl = new URL('dist/module/hoc/withUniwind.native.js', import.meta.resolve('uniwind/package.json')).href;
const prefix = 'native-container-contract:';
const leaf = (names: string[]) => names.map(name => `export const ${name} = '${name}';`).join('\n');
const leaves: Record<string, string> = {
  '@expo/ui': leaf(['Host', 'Collapsible', 'List', 'ListItem', 'RNHostView']),
  '@expo/html-elements': leaf(['Div', 'Span', 'Main', 'Section', 'Article', 'Nav', 'Header', 'Footer', 'H1', 'H2', 'H3', 'P']),
  'react-native': leaf(['ScrollView', 'FlatList']),
  './html/dom': leaf(['ButtonBase', 'InputBase']),
  './rn-globals-shim': '',
  // Hooks/native stylesheet generation are device leaves. The fixture represents
  // compiled RN-supported utilities; this tests forwarding, not CSS compilation.
  react: `export const useCallback = fn => fn;
    export const useReducer = (_reducer, initial, init) => [init(initial), () => {}];
    export const useLayoutEffect = () => {};`,
  '../core/context.js': 'export const useUniwindContext = () => undefined;',
  '../core/listener.js': 'export const UniwindListener = { getSnapshot: () => 0 };',
  '../core/logger.js': 'export const Logger = { warn: () => {} };',
  '../core/native/index.js': `export const resolved = {
      'mt-4 p-4 bg-surface-raised': { marginTop: 16, padding: 16, backgroundColor: '#242424' },
      hidden: { display: 'none' },
      'opacity-50': { opacity: 0.5 },
    };
    export const UniwindStore = { getStyles: name => {
      if (name !== undefined && !(name in resolved)) throw Error('Missing style fixture: ' + name);
      return { styles: resolved[name] ?? {}, dependencies: [] };
    } };`,
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true };
    if (context.parentURL && sources.includes(context.parentURL)) {
      if (specifier in leaves && specifier !== 'react') return { url: `${prefix}${specifier}`, shortCircuit: true };
      if (specifier === 'uniwind') return next(uniwindUrl, context);
      const local: Record<string, string> = {
        './tw': twUrl, './html/css': cssUrl, './NativeSlot.native': slotUrl,
      };
      if (specifier in local) return next(local[specifier]!, context);
    }
    if (context.parentURL === uniwindUrl && specifier in leaves) {
      return { url: `${prefix}${specifier}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(prefix)) return {
      format: 'module', shortCircuit: true, source: leaves[url.slice(prefix.length)]!,
    };
    if (sources.includes(url)) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});
let Collapsible: typeof import('./Collapsible.native').Collapsible;
let List: typeof import('./List.native').List;
let ListItem: typeof import('./List.native').ListItem;
try {
  ({ Collapsible } = await import(collapsibleUrl));
  ({ List, ListItem } = await import(listUrl));
} finally {
  hooks.deregister();
}

type Element = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
function render(node: ReactNode): Element {
  assert.ok(isValidElement<Element['props']>(node));
  let result = node;
  while (typeof result.type === 'function') result = (result.type as (props: Element['props']) => Element)(result.props);
  return result;
}
function disclosure(className?: string, isOpen = false, onOpenChange = (_open: boolean) => {}) {
  return render(Collapsible({ label: 'Travel details', isOpen, onOpenChange,
    className, children: createElement('NativeContent', { testID: 'details' }) }));
}

test('Collapsible resolves supported box classes outside the content-measuring native Host', () => {
  const box = disclosure('mt-4 p-4 bg-surface-raised');
  assert.equal(box.type, 'Div');
  assert.deepEqual(box.props.style, [{ marginTop: 16, padding: 16, backgroundColor: '#242424' }]);
  const host = render(box.props.children);
  assert.equal(host.type, 'Host');
  assert.equal(host.props.matchContents, true);
  assert.equal(host.props.style, undefined);
  assert.equal(host.props.className, undefined);
  const native = render(host.props.children);
  assert.equal(native.type, 'Collapsible');
  assert.equal(native.props.className, undefined);
  assert.equal(native.props.style, undefined);
  assert.equal(render(native.props.children).type, 'NativeContent');
});

test('Collapsible updates and removes visibility/appearance classes without replacing the native control', () => {
  const initial = disclosure('hidden');
  const updated = disclosure('opacity-50');
  const reset = disclosure();
  for (const box of [initial, updated, reset]) {
    assert.equal(box.type, 'Div');
    assert.equal(render(render(box.props.children).props.children).type, 'Collapsible');
  }
  assert.deepEqual(initial.props.style, [{ display: 'none' }]);
  assert.deepEqual(updated.props.style, [{ opacity: 0.5 }]);
  assert.deepEqual(reset.props.style, [{}]);
});

test('Collapsible keeps the caller-controlled state, native children and change callback unchanged', () => {
  const changes: boolean[] = [];
  const onOpenChange = (next: boolean) => { changes.push(next); };
  for (const isOpen of [false, true, false]) {
    const box = disclosure('mt-4 p-4 bg-surface-raised', isOpen, onOpenChange);
    // This also accepts the original no-wrapper composition for the red baseline.
    const host = box.type === 'Host' ? box : render(box.props.children);
    const native = render(host.props.children);
    assert.equal(native.props.label, 'Travel details');
    assert.equal(native.props.isOpen, isOpen);
    assert.equal(native.props.onOpenChange, onOpenChange);
    assert.equal(render(native.props.children).props.testID, 'details');
    (native.props.onOpenChange as typeof onOpenChange)(!isOpen);
    assert.equal(native.props.isOpen, isOpen);
  }
  assert.deepEqual(changes, [true, false, true]);
});

test('native List remains a platform list with refresh and row press callbacks intact', async () => {
  let refreshed = 0;
  let pressed = 0;
  const onRefresh = async () => { refreshed += 1; };
  const onPress = () => { pressed += 1; };
  const children = createElement('SavedPlaceCard');
  const leading = createElement('Leading');
  const trailing = createElement('Trailing');
  const row = render(ListItem({ children, onPress, leading, trailing, supportingText: 'Harlem' }));
  assert.equal(row.type, 'ListItem');
  assert.equal(row.props.onPress, onPress);
  assert.equal(row.props.leading, leading);
  assert.equal(row.props.trailing, trailing);
  assert.equal(row.props.supportingText, 'Harlem');
  const slot = render(row.props.children);
  assert.equal(slot.type, 'RNHostView');
  assert.equal(slot.props.matchContents, true);
  assert.equal(slot.props.children, children);
  const host = render(List({ children: row, onRefresh }));
  assert.equal(host.type, 'Host');
  assert.equal(host.props.matchContents, true);
  const list = render(host.props.children);
  assert.equal(list.type, 'List');
  assert.equal(list.props.children, row);
  assert.equal(list.props.onRefresh, onRefresh);
  await (list.props.onRefresh as typeof onRefresh)();
  (row.props.onPress as typeof onPress)();
  assert.equal(refreshed, 1);
  assert.equal(pressed, 1);
});


test('public native Collapsible consumers compile against the installed Expo and Uniwind types', () => {
  const program = ts.createProgram({
    rootNames: [fileURLToPath(new URL('./__typechecks__/collapsible-container.native.tsx', import.meta.url))],
    options: {
      strict: true, noEmit: true, skipLibCheck: true, types: [],
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022,
      moduleSuffixes: ['.native', ''], allowImportingTsExtensions: true,
    },
  });
  assert.ok(program.getSourceFile(fileURLToPath(new URL('./Collapsible.native.tsx', import.meta.url))));
  assert.equal(program.getSourceFile(fileURLToPath(new URL('./Collapsible.web.tsx', import.meta.url))), undefined);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
  });
  assert.equal(diagnostics.length, 0, formatted);
});
