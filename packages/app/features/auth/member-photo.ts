// TS resolution anchor. Metro and Next load member-photo.native.ts /
// member-photo.web.ts — the shared profile screen imports from this file so
// each platform gets its own picker.
export { pickMemberPhoto } from './member-photo.web';
export type { MemberPhotoAsset } from './member-photo.web';
