import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';
import type { CircuitButtonProps } from './CircuitButton';
import type { GridCardProps } from './GridCard';

const buttonUrl = new URL('./CircuitButton.tsx', import.meta.url).href;
const cardUrl = new URL('./GridCard.tsx', import.meta.url).href;
const sources = [buttonUrl, cardUrl];
// Execute the real shared controls. Only the platform styling boundary is inert;
// this verifies the same class/prop contract passed to web and native wrappers.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL && sources.includes(context.parentURL) && specifier === '../tw') {
      return { url: 'semantic-controls:tw', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'semantic-controls:tw') return {
      format: 'module', shortCircuit: true,
      source: "export const Pressable = 'Pressable'; export const Text = 'Text'; export const View = 'View';",
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
const { CircuitButton } = await import(buttonUrl) as typeof import('./CircuitButton');
const { GridCard } = await import(cardUrl) as typeof import('./GridCard');
hooks.deregister();

type Element = ReactElement<{ children?: ReactNode; className?: string; onPress?: () => void }>;
function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap(child => isValidElement<Element['props']>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function classes(node: ReactNode) {
  return elements(node).map(element => element.props.className ?? '').join(' ');
}
function labels(node: ReactNode) {
  return elements(node).filter(element => element.type === 'Text').map(element => element.props.children);
}

for (const variant of ['outline', 'solid'] as const) {
  test(`CircuitButton orange remains an exact accent alias for ${variant}`, () => {
    const props = { children: 'Enter the Grid', className: 'custom-button', onPress: () => {}, variant };
    assert.deepEqual(CircuitButton({ ...props, tone: 'orange' }), CircuitButton({ ...props, tone: 'accent' }));
  });

  test(`CircuitButton cyan preserves its focus-color contract for ${variant}`, () => {
    const props = { children: 'Diagnostics', variant };
    const cyan = classes(CircuitButton({ ...props, tone: 'cyan' }));
    assert.match(cyan, /\bbg-focus\b/);
    assert.match(cyan, variant === 'solid' ? /\btext-text-inverse\b/ : /\btext-focus\b/);
    assert.notEqual(cyan, classes(CircuitButton({ ...props, tone: 'primary' })));
  });
}

test('CircuitButton preserves primary/outline defaults, content, custom classes and press handler', () => {
  let presses = 0;
  const props = { children: 'Start race', className: 'consumer-class', onPress: () => { presses++; } };
  const rendered = CircuitButton(props);
  assert.deepEqual(rendered, CircuitButton({ ...props, tone: 'primary', variant: 'outline' }));
  assert.equal(rendered.type, 'Pressable');
  assert.equal(rendered.props.onPress, props.onPress);
  rendered.props.onPress?.();
  assert.equal(presses, 1);
  assert.match(classes(rendered), /\bconsumer-class\b/);
  assert.deepEqual(labels(rendered), ['Start race']);
});

test('GridCard orange remains an exact accent alias, including its label and children', () => {
  const props = { title: 'Spatial backend', label: 'Runtime', children: 'Available', className: 'consumer-card' };
  assert.deepEqual(GridCard({ ...props, tone: 'orange' }), GridCard({ ...props, tone: 'accent' }));
  assert.deepEqual(GridCard(props), GridCard({ ...props, tone: 'primary' }));
  assert.match(classes(GridCard(props)), /\bconsumer-card\b/);
  assert.ok(elements(GridCard(props)).some(element => element.props.children === 'Available'));
});

test('GridCard preserves cyan focus and verdigris styling', () => {
  const props = { title: 'System online', label: 'Node A' };
  const cyan = classes(GridCard({ ...props, tone: 'cyan' }));
  assert.match(cyan, /\bbg-focus\b/);
  assert.match(cyan, /\btext-focus\b/);
  assert.match(cyan, /\bborder-focus\/60\b/);
  assert.notEqual(cyan, classes(GridCard({ ...props, tone: 'primary' })));
  const verdigris = classes(GridCard({ ...props, tone: 'verdigris' }));
  assert.match(verdigris, /\bbg-forest-600\b/);
  assert.match(verdigris, /text-forest-700 dark:text-forest-300/);
});

test('GridCard keeps the eyebrow fallback without changing label text or case', () => {
  const props = { title: 'A place is more than a pin', className: 'card-class' };
  assert.deepEqual(GridCard({ ...props, eyebrow: 'West 125th Street' }), GridCard({ ...props, label: 'West 125th Street' }));
  assert.deepEqual(labels(GridCard({ ...props, eyebrow: 'XR Gateway', label: undefined })), ['XR Gateway', props.title]);
  assert.deepEqual(labels(GridCard({ ...props, eyebrow: 'Legacy', label: 'Current label' })), ['Current label', props.title]);
});

test('GridCard respects an explicit empty label and does not render missing context or body', () => {
  assert.deepEqual(GridCard({ title: 'Title', eyebrow: 'Hidden', label: '' }), GridCard({ title: 'Title' }));
  assert.deepEqual(labels(GridCard({ title: 'Title', eyebrow: '' })), ['Title']);
  assert.ok(!elements(GridCard({ title: 'Title' })).some(element => element.props.className === 'mt-3 gap-2'));
});

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) return sourceFiles(url);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [url] : [];
  });
}

test('internal control consumers use semantic props with the same rendered output as legacy aliases', () => {
  const root = new URL('../../../', import.meta.url);
  const counts = { CircuitButton: 0, GridCard: 0 };
  // Discover consumers instead of fixing their paths, so spatial module moves
  // and new stories keep the same contract coverage.
  for (const url of [...sourceFiles(new URL('packages/', root)), ...sourceFiles(new URL('apps/', root))]) {
    const source = readFileSync(url, 'utf8');
    if (!source.includes('CircuitButton') && !source.includes('GridCard')) continue;
    const file = ts.createSourceFile(url.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const controls = new Map<string, keyof typeof counts>();
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const binding of bindings.elements) {
        const imported = (binding.propertyName ?? binding.name).text;
        if (imported === 'CircuitButton' || imported === 'GridCard') controls.set(binding.name.text, imported);
      }
    }
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const control = controls.get(node.tagName.getText(file));
        if (control) {
          counts[control]++;
          const location = `${url.pathname}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
          const props: Record<string, string> = {};
          for (const attribute of node.attributes.properties) {
            if (!ts.isJsxAttribute(attribute)) continue;
            const name = attribute.name.getText(file);
            assert.ok(control !== 'GridCard' || name !== 'eyebrow', `${location}: use GridCard label`);
            if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) props[name] = attribute.initializer.text;
          }
          assert.notEqual(props.tone, 'orange', `${location}: use the equivalent accent tone`);
          if (control === 'GridCard') {
            const cardProps = { ...props, title: props.title ?? 'Dynamic title' } as GridCardProps;
            const { label, ...rest } = cardProps;
            assert.deepEqual(GridCard(cardProps), GridCard({ ...rest, eyebrow: label, tone: cardProps.tone === 'accent' ? 'orange' : cardProps.tone }), location);
          } else {
            const buttonProps = { ...props, children: 'Consumer content' } as CircuitButtonProps;
            assert.deepEqual(CircuitButton(buttonProps), CircuitButton({ ...buttonProps, tone: buttonProps.tone === 'accent' ? 'orange' : buttonProps.tone }), location);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  assert.ok(counts.CircuitButton > 0 && counts.GridCard > 0, 'both controls must have consumer coverage');
});
