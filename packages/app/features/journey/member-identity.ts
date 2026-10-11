import type { JourneyController } from './controller.ts';

interface MemberIdentity { member: { id: string | number } | null; status?: string }

/** Subscribe to explicit owner changes without importing a platform runtime. */
export function observeJourneyMemberIdentity(
  controller: Pick<JourneyController, 'identityChanged'>,
  store: { subscribe(listener: (state: MemberIdentity, previous: MemberIdentity) => void): () => void },
): () => void {
  const owner = (state: MemberIdentity) => state.member ? String(state.member.id) : null;
  return store.subscribe((state, previous) => {
    if (owner(state) !== owner(previous) || (state.status === 'signed-out' && previous.status !== 'signed-out')) {
      controller.identityChanged(owner(state));
    }
  });
}
