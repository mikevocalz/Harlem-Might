import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// Vite substitutes import.meta.env at build time. Replace only that deployment
// binding here; execute the real form adapter, shared domain and auth actions.
const adapterUrl = new URL('./member-session.ts', import.meta.url).href;
for (const apiBase of ['/gateway/member-api/', 'https://cms.example.invalid/custom/member-api/']) {
  test(`Vite keeps its form and shared session on configured mount ${apiBase}`, async (t) => {
    const hooks = registerHooks({
      resolve(specifier, context, next) {
        if (context.parentURL?.startsWith(adapterUrl) && specifier === './payload.ts') {
          return { url: `data:text/javascript,${encodeURIComponent(`export const PAYLOAD_API_BASE = ${JSON.stringify(apiBase)};`)}`, shortCircuit: true };
        }
        return next(specifier, context);
      },
    });
    t.after(() => hooks.deregister());
    const { useMemberSession: session, useMemberAuthForm: form } = await import(`${adapterUrl}?base=${encodeURIComponent(apiBase)}`) as typeof import('./member-session.ts');
    const member = { id: 'member', email: 'member@example.invalid', name: 'Member', image: 'https://media.example.invalid/photo.png' };
    const calls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      assert.ok(url.startsWith(apiBase.replace(/\/+$/, '') + '/'));
      assert.equal(init?.credentials, 'include');
      if (url.endsWith('/get-session')) return Response.json({ user: member });
      return Response.json({ docs: [] });
    });
    form.setState({ mode: 'register', name: ' Member ', email: member.email, password: 'fixture-only' });
    const submitting = form.getState().submit();
    assert.equal(form.getState().password, '');
    await submitting;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(session.getState().member, member);
    assert.equal(form.getState().error, null);
    await session.getState().savePlace(42);
    await session.getState().removeSavedPlace(43);
    await form.getState().signOut();
    for (const endpoint of ['/auth/sign-up/email', '/auth/sign-in/email', '/auth/get-session', '/saved-places', '/saved-places/43', '/auth/sign-out']) {
      assert.ok(calls.some((url) => url.endsWith(endpoint)), endpoint);
    }
    assert.equal(form.getState().email, '');
    assert.equal(form.getState().name, '');
    assert.equal('member' in form.getState(), false);
    assert.equal('savedPlaces' in form.getState(), false);
    assert.equal('password' in session.getState(), false);
  });
}
