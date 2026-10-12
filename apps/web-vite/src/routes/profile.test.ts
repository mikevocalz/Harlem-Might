import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { beforeEach, test } from 'node:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import ts from 'typescript';
import { useMemberSession } from '../lib/member-session.ts';

// Execute the actual route composition with inert leaf UI elements. This
// verifies feedback/actions, not primitive rendering or browser appearance.
const profileUrl = new URL('./profile.tsx', import.meta.url).href;
const leaves = (names: string[]) => names.map((name) => `export const ${name} = '${name}';`).join('\n');
const boundaries: Record<string, string> = {
  react: 'export function useEffect() {}',
  '@tanstack/react-router': "export const Link = 'Link'; export const createFileRoute = () => config => config;",
  '@acme/ui': leaves(['Avatar', 'Button', 'Card', 'EmptyState', 'Heading', 'Text', 'TextField']),
  '@acme/ui/tw': leaves(['Main', 'Section', 'View']),
  '@/lib/member-session': `import { useMemberSession as store } from '${new URL('../lib/member-session.ts', import.meta.url).href}'; export const useMemberSession = selector => selector(store.getState());`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === profileUrl && specifier in boundaries) return { url: `profile-ui-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('profile-ui-test:')) return { format: 'module', source: boundaries[url.slice('profile-ui-test:'.length)]!, shortCircuit: true };
    if (url === profileUrl) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText };
    return next(url, context);
  },
});
const { Route } = await import(profileUrl) as { Route: { component: () => ReactNode } };
type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Element['props']>(child)) return [];
    if (typeof child.type === 'function') return elements((child.type as (props: Element['props']) => ReactNode)(child.props));
    return [child, ...elements(child.props.children)];
  });
}
const text = (node: ReactNode): string => Children.toArray(node).map((child) => isValidElement<Element['props']>(child) ? text(child.props.children) : typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');
const button = (tree: Element[], title: string) => tree.find((element) => element.type === 'Button' && element.props.title === title);
beforeEach(() => useMemberSession.setState({ status: 'signed-out', member: null, savedPlaces: [], signOutError: null, signOutPending: false, error: null, mode: 'login' }));

test('unconfirmed logout is visible with a working retry action', async (t) => {
  useMemberSession.setState({ signOutError: 'Sign-out could not be confirmed. Please retry.' });
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  const tree = elements(Route.component());
  assert.ok(tree.some((element) => element.props.role === 'status' && text(element).includes('could not be confirmed')));
  const retry = button(tree, 'Retry sign-out');
  assert.ok(retry && typeof retry.props.onPress === 'function');
  retry.props.onPress();
  await useMemberSession.getState().signOut();
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(useMemberSession.getState().signOutError, null);
});

test('pending logout disables sign-in and retry controls', () => {
  useMemberSession.setState({ signOutPending: true });
  const tree = elements(Route.component());
  assert.equal(button(tree, 'Retry sign-out')?.props.disabled, true);
  const signIn = tree.filter((element) => element.type === 'Button' && element.props.title === 'Sign in').find((element) => element.props.fullWidth);
  assert.equal(signIn?.props.disabled, true);
  assert.ok(tree.some((element) => element.props.role === 'status' && text(element).includes('Confirming sign-out')));
});

test('signed-in saved-place failures are announced without hiding the existing list', () => {
  useMemberSession.setState({ status: 'signed-in', member: { id: 7, email: 'member@example.test' }, savedPlaces: [{ id: 9, place: 5, createdAt: '2026-01-01' }], error: 'Could not remove this place. Try again.' });
  const tree = elements(Route.component());
  assert.ok(tree.some((element) => element.props.role === 'alert' && text(element).includes('Could not remove this place')));
  assert.ok(button(tree, 'Remove'));
});
