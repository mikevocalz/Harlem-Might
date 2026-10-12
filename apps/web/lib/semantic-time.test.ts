import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const webUrl = new URL('../../../packages/ui/html/dom.web.tsx', import.meta.url).href;
const nativeUrl = new URL('../../../packages/ui/html/dom.native.tsx', import.meta.url).href;
const nativeBoundaries: Record<string, string> = {
  'react-native': "export const Pressable = 'NativePressable'; export const StyleSheet = { create: value => value, flatten: value => value };",
  '@expo/html-elements': "export const Div = 'NativeView'; export const Span = 'NativeText';",
  '@expo/ui': "export const Host = 'Host'; export const Picker = 'Picker';",
  './native-input.native': "export const NativeInput = 'NativeInput';",
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === nativeUrl && specifier in nativeBoundaries) return { url: `time-native-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('time-native-test:')) return { format: 'module', source: nativeBoundaries[url.slice('time-native-test:'.length)]!, shortCircuit: true };
    if ([webUrl, nativeUrl].includes(url)) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText };
    return next(url, context);
  },
});
type TimeProps = { dateTime?: string; children?: ReactNode; className?: string; style?: unknown };
const web = await import(webUrl) as { TimeBase: ComponentType<TimeProps> };
const native = await import(nativeUrl) as { TimeBase: (props: TimeProps) => ReactElement<Record<string, unknown>> };

test('web dates are real time elements with a machine-readable datetime', () => {
  const html = renderToStaticMarkup(createElement('span', null, 'Checked ', createElement(web.TimeBase, { dateTime: '2026-10-01' }, 'October 1')));
  assert.equal(html, '<span>Checked <time dateTime="2026-10-01">October 1</time></span>');
});

test('time preserves direct classes and the shared styling-boundary encoding', () => {
  const html = renderToStaticMarkup(createElement(web.TimeBase, { dateTime: '2026-10-01', className: 'text-inherit', style: [{ $$css: true, font: 'font-inherit' }, { color: 'inherit' }] }, 'October 1'));
  assert.match(html, /^<time class="text-inherit font-inherit" style="color:inherit" dateTime="2026-10-01">/);
});

test('visible date text remains when no machine-readable value is supplied', () => {
  assert.equal(renderToStaticMarkup(createElement(web.TimeBase, null, 'Date unknown')), '<time>Date unknown</time>');
});

test('React escapes date attributes instead of admitting HTML', () => {
  const html = renderToStaticMarkup(createElement(web.TimeBase, { dateTime: '\" onmouseover=\"bad' }, 'Visible date'));
  assert.equal(html, '<time dateTime="&quot; onmouseover=&quot;bad">Visible date</time>');
});

test('native dates retain text and styling without passing a DOM-only attribute', () => {
  const element = native.TimeBase({ dateTime: '2026-10-01', className: 'text-inherit', children: 'October 1' });
  assert.equal(element.type, 'NativeText');
  assert.equal(element.props.children, 'October 1');
  assert.equal(element.props.className, 'text-inherit');
  assert.equal('dateTime' in element.props, false);
});
