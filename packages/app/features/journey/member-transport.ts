import { validateWalkSession, type WalkCommand, type WalkSession } from '@acme/widgets';
import { JourneyConflict, JourneyIdentityChanged, type JourneyTransport } from './controller.ts';

/** Cookie-bound, same-origin member transport. Never stores/copies cookies or tokens. */
export function createMemberJourneyTransport(baseUrl = '', request: typeof fetch = fetch): JourneyTransport {
  let owner: string | null = null;
  async function readOwner(): Promise<string | null> {
    const response = await request(`${baseUrl}/payload-api/auth/get-session`, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error('Could not check your login. Try again before starting a walk.');
    const body = await response.json();
    const current = body?.user?.id;
    return typeof current === 'string' || typeof current === 'number' ? String(current) : null;
  }
  async function verifyIdentity() {
    const current = await readOwner();
    if (!owner || current !== owner) throw new JourneyIdentityChanged();
  }
  return {
    async identity() { owner = await readOwner(); return owner ? 'member' : 'local'; },
    verifyIdentity,
    async send(command: WalkCommand): Promise<WalkSession> {
      await verifyIdentity();
      const response = await request(`${baseUrl}/payload-api/walk-sessions/command`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command),
      });
      const body = await response.json();
      if (response.status === 409 && body?.code === 'revision-conflict') {
        validateWalkSession(body.session);
        if (body.session.sessionId !== command.sessionId) throw new Error('The service returned a different walk session.');
        throw new JourneyConflict(body.session);
      }
      if (response.status === 401 || response.status === 403) throw new JourneyIdentityChanged();
      if (!response.ok) throw new Error('Could not save your walk. Reconnect and try again.');
      if (body.schemaVersion !== 1) throw new Error('Unsupported walk response.');
      validateWalkSession(body.session);
      if (body.session.sessionId !== command.sessionId) throw new Error('The service returned a different walk session.');
      return body.session;
    },
  };
}
