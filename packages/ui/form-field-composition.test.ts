import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';

// Real control/FormField composition; inert native/DOM leaves isolate semantics.
const urls = ['TextField', 'Textarea', 'Select', 'FormField'].map(name => new URL(`./${name}.tsx`, import.meta.url).href);
const leaf = (names: string[]) => names.map(name => `export const ${name} = '${name}';`).join('\n');
const boundaries: Record<string, string> = {
  './tw': leaf(['View', 'Text']), './primitives': leaf(['Input', 'Textarea', 'Select', 'Label']),
  './Text': leaf(['Text']), './paste-wrapper': leaf(['PasteWrapper']),
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL && urls.includes(context.parentURL)) {
      if (specifier in boundaries) return { url: `field-test:${specifier}`, shortCircuit: true };
      if (specifier === './FormField') return next(urls[3]!, context);
      if (specifier === './tv') return next(new URL('./tv.ts', import.meta.url).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('field-test:')) return { format: 'module', source: boundaries[url.slice('field-test:'.length)]!, shortCircuit: true };
    if (urls.includes(url)) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText };
    return next(url, context);
  },
});
type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
const elements = (node: ReactNode): Element[] => Children.toArray(node).flatMap(child => {
  if (!isValidElement<Element['props']>(child)) return [];
  if (typeof child.type === 'function') return elements((child.type as (props: Element['props']) => ReactNode)(child.props));
  return [child, ...elements(child.props.children)];
});
for (const name of ['TextField', 'Textarea', 'Select']) {
  const module = await import(new URL(`./${name}.tsx`, import.meta.url).href) as Record<string, (props: Record<string, unknown>) => ReactNode>;
  const render = module[name]!;
  const inputType = name === 'TextField' ? 'Input' : name;
  test(`${name} announces errors through one shared label/message shell`, () => {
    const tree = elements(render({ label: 'Destination', error: 'Choose a place', hint: 'Nearby only', containerClassName: 'field-container', className: 'control-custom' }));
    assert.equal(tree.filter(node => node.type === 'Label').length, 1);
    assert.equal(tree.find(node => node.type === 'Label')?.props.children, 'Destination');
    const alerts = tree.filter(node => node.props.role === 'alert');
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]?.props.children, 'Choose a place');
    assert.equal(tree.some(node => node.props.children === 'Nearby only'), false);
    assert.match(String(tree[0]?.props.className), /field-container/);
    const input = tree.find(node => node.type === inputType);
    assert.equal(input?.props['aria-label'], 'Destination');
    assert.match(String(input?.props.className), /control-custom/);
  });
  test(`${name} retains hint and control-only disabled styling`, () => {
    const tree = elements(render({ label: 'Destination', hint: 'Nearby only', disabled: true }));
    assert.equal(tree.filter(node => node.props.role === 'alert').length, 0);
    assert.equal(tree.find(node => node.props.children === 'Nearby only')?.props.tone, 'muted');
    assert.doesNotMatch(String(tree[0]?.props.className), /opacity-50/);
    const input = tree.find(node => node.type === inputType);
    assert.match(String(input?.props.className), /opacity-50/);
    assert.equal(name === 'Select' ? input?.props.disabled : input?.props.editable, name === 'Select');
  });
  if (name !== 'Select') test(`${name} preserves rich paste behavior`, () => {
    const onPaste = () => {};
    const tree = elements(render({ label: 'Notes', onPaste }));
    assert.equal(tree.find(node => node.type === 'PasteWrapper')?.props.onPaste, onPaste);
    assert.equal(tree.filter(node => node.props.children === '⌘V').length, 1);
    assert.equal(tree.filter(node => node.type === 'Label').length, 1);
  });
}
