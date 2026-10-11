import { validateWalkSession, type WalkCommand, type WalkSession } from '@acme/widgets';
import { JourneyConflict, JourneyIdentityChanged, type JourneyTransport } from './controller.ts';

/** Cookie-bound, same-origin member transport. Never stores/copies cookies or tokens. */
export function createMemberJourneyTransport(baseUrl = '', request: typeof fetch = fetch): JourneyTransport {
  let owner: string | null = null;
  let generation = 0;
  let lifetime = new AbortController();
  const invalidateIdentity = () => {
    generation++;
    owner = null;
    lifetime.abort();
    lifetime = new AbortController();
  };
  const assertCurrent = (version: number) => {
    if (version !== generation) throw new JourneyIdentityChanged();
  };
  async function readOwner(version: number): Promise<string | null> {
    const response = await request(`${baseUrl}/payload-api/auth/get-session`, { credentials: 'include', cache: 'no-store', signal: lifetime.signal });
    assertCurrent(version);
    if (!response.ok) throw new Error('Could not check your login. Try again before starting a walk.');
    const body = await response.json();
    assertCurrent(version);
    const current = body?.user?.id;
    return typeof current === 'string' || typeof current === 'number' ? String(current) : null;
  }
  async function verifyIdentity(version = generation, expectedOwner = owner) {
    const current = await readOwner(version);
    assertCurrent(version);
    if (!expectedOwner || current !== expectedOwner || owner !== expectedOwner) throw new JourneyIdentityChanged();
  }
  return {
    async identity() {
      invalidateIdentity();
      const version = generation;
      const current = await readOwner(version);
      assertCurrent(version);
      owner = current;
      return owner ? 'member' : 'local';
    },
    invalidateIdentity,
    matchesIdentity: current => owner !== null && owner === current,
    verifyIdentity,
    async send(command: WalkCommand): Promise<WalkSession> {
      const version = generation;
      await verifyIdentity(version, owner);
      assertCurrent(version);
      const response = await request(`${baseUrl}/payload-api/walk-sessions/command`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: lifetime.signal,
      });
      assertCurrent(version);
      // Auth failures must revoke the journey even when a proxy returns HTML or no body.
      if (response.status === 401 || response.status === 403) throw new JourneyIdentityChanged();
      const saveError = 'Could not save your walk. Reconnect and try again.';
      if (!response.ok && response.status !== 409) throw new Error(saveError);
      const body = await response.json().catch(() => {
        // Cancellation still wins if the pending body fails to parse after logout.
        assertCurrent(version);
        throw new Error(response.ok ? 'Unsupported walk response.' : saveError);
      });
      assertCurrent(version);
      if (response.status === 409 && body?.code === 'revision-conflict') {
        validateWalkSession(body.session);
        if (body.session.sessionId !== command.sessionId) throw new Error('The service returned a different walk session.');
        throw new JourneyConflict(body.session);
      }
      if (!response.ok) throw new Error(saveError);
      if (body?.schemaVersion !== 1) throw new Error('Unsupported walk response.');
      validateWalkSession(body.session);
      if (body.session.sessionId !== command.sessionId) throw new Error('The service returned a different walk session.');
      return body.session;
    },
  };
}
