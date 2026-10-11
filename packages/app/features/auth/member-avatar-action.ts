import type { MemberPhotoAsset } from './member-photo.ts';
import { useMemberSession, type MemberSessionResult } from './member-session.ts';

/** Keep a picker opened by A from starting an upload for B or a later A session. */
export async function pickAndUploadMemberAvatar(
  pick: () => Promise<MemberPhotoAsset | null>,
  isMounted: () => boolean,
  preview: (photo: MemberPhotoAsset) => void,
): Promise<MemberSessionResult | null> {
  const isCurrent = useMemberSession.getState().captureIdentity();
  if (!isCurrent()) return { ok: false, message: 'You are not signed in.' };
  const photo = await pick();
  if (!photo) return null;
  if (!isMounted() || !isCurrent()) {
    if (photo.uri.startsWith('blob:')) URL.revokeObjectURL(photo.uri);
    return { ok: false, message: 'Your login changed or the profile was closed. Choose the photo again.' };
  }
  preview(photo);
  return useMemberSession.getState().uploadAvatar(photo);
}
