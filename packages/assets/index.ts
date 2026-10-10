// @acme/assets — typed exports for brand assets; no magic string paths in app code.
//
// Brand fonts live in ./fonts: the Mona Sans and Newsreader variable woff2
// files for the web (next/font localFont, apps/web/app/fonts.ts) and their
// static TTF instances in ./fonts/native for the app (expo-font plugin,
// apps/mobile/app.config.ts). Neither loader imports through this module.
export {
  HARLEM_ARCHIVAL_IMAGES,
  editorialImageContentFit,
  getHarlemArchivalImage,
  imageAspect,
  isDisplayableEditorialImage,
} from './editorial-images.ts';
export type { EditorialImage, EditorialImageRole, EditorialImageSource } from './editorial-images.ts';
export { createEditorialImageStore, editorialImageStateKey, useEditorialImageStore } from './editorialImage.store.ts';
export type { EditorialImageStatus } from './editorialImage.store.ts';
