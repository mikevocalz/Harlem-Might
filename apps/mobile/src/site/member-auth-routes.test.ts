import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { siteOrigin } from './site-url.ts';

const initialAppUrl = process.env.EXPO_PUBLIC_APP_URL;
const initialLegacyUrl = process.env.EXPO_PUBLIC_SITE_URL;
afterEach(() => {
  for (const [key, value] of [
    ['EXPO_PUBLIC_APP_URL', initialAppUrl], ['EXPO_PUBLIC_SITE_URL', initialLegacyUrl],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

type RouteElement = { type: unknown; props: { intent?: string; siteUrl: string } };
function renderRoute(path: string): RouteElement {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = transpileModule(source, { compilerOptions: {
    module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022,
  } }).outputText;
  const output: { default?: () => RouteElement } = {};
  const screen = Symbol('shared screen');
  // Execute the real route module and real siteOrigin helper. Only the JSX leaf
  // is controlled: this verifies host binding without UI, requests or credentials.
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx: (type: unknown, props: RouteElement['props']) => ({ type, props }) },
    '@acme/app/features/auth/MemberAuthScreen.tsx': { MemberAuthScreen: screen },
    '@acme/app/features/auth/MemberProfileScreen.tsx': { MemberProfileScreen: screen },
    '@/src/site/site-url': { siteOrigin },
  };
  new Function('require', 'exports', compiled)((id: string) => {
    assert.ok(Object.hasOwn(modules, id), `Unexpected route dependency: ${id}`);
    return modules[id];
  }, output);
  assert.ok(output.default);
  const element = output.default();
  assert.equal(element.type, screen);
  return element;
}

for (const [name, appUrl, legacyUrl, expected] of [
  ['documented app origin', 'https://harlem.example.test', undefined, 'https://harlem.example.test'],
  ['normalized deployment mount', '  https://harlem.example.test/harlem///  ', undefined, 'https://harlem.example.test/harlem'],
  ['current origin over obsolete setting', 'https://harlem.example.test', 'https://retired.example.test', 'https://harlem.example.test'],
  ['unconfigured origin', undefined, undefined, ''],
  ['blank origin does not revive an obsolete setting', '   ', 'https://retired.example.test', ''],
] as const) {
  test(`mobile member routes share the ${name}`, () => {
    if (appUrl === undefined) delete process.env.EXPO_PUBLIC_APP_URL;
    else process.env.EXPO_PUBLIC_APP_URL = appUrl;
    if (legacyUrl === undefined) delete process.env.EXPO_PUBLIC_SITE_URL;
    else process.env.EXPO_PUBLIC_SITE_URL = legacyUrl;
    const signIn = renderRoute('../../app/(auth)/sign-in.tsx');
    const signUp = renderRoute('../../app/(auth)/sign-up.tsx');
    const profile = renderRoute('../../app/(tabs)/(more)/profile.tsx');
    assert.equal(signIn.props.intent, 'sign-in');
    assert.equal(signUp.props.intent, 'sign-up');
    assert.equal(signIn.props.siteUrl, expected);
    assert.equal(signUp.props.siteUrl, expected);
    assert.equal(profile.props.siteUrl, expected);
    assert.equal(signIn.props.siteUrl, siteOrigin() ?? '');
  });
}
