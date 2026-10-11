import type { MemberSessionStatus } from './member-session.ts';

/** Presentation only: retaining chrome during a read never certifies identity. */
export function memberMenuMode(status: MemberSessionStatus, hasMember: boolean, checkedSite: string | null, siteUrl: string) {
  if (hasMember && (status === 'signed-in' || status === 'loading')) return 'member';
  if (status === 'signed-out' || (status === 'loading' && checkedSite === siteUrl)) return 'signed-out';
  return 'pending';
}
