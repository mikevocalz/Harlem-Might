import type { JourneyController } from './controller.ts';

interface MemberIdentity { member: { id: string | number } | null; status?: string; authBoundary?: number }

/** Subscribe to explicit owner changes without importing a platform runtime. */
export function observeJourneyMemberIdentity(
  controller: Pick<JourneyController, 'identityChanged'>,
  store: { subscribe(listener: (state: MemberIdentity, previous: MemberIdentity) => void): () => void },
): () => void {
  const owner = (state: MemberIdentity) => state.member ? String(state.member.id) : null;
  return store.subscribe((state, previous) => {
    if (state.authBoundary !== previous.authBoundary) {
      // Explicit auth actions (including repeated logout and its confirmation)
      // revoke work even when the session mirror was already signed out.
      controller.identityChanged(null);
    } else if (owner(state) !== owner(previous) || (state.status === 'signed-out' && previous.status !== 'signed-out')) {
      controller.identityChanged(owner(state));
    }
  });
}
