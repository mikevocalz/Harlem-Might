// The five status words, one meaning each, from docs/META_VR_GLASSES.md.
// Public copy uses only these. "verified" needs all 8 points of
// docs/XR-PLATFORM-MATRIX.md recorded on the real device, and no target has
// that record today, so no row may use it until one does.
export const STATUS_WORDS = ['preview', 'concept', 'integration path', 'in testing', 'verified'] as const;
export type StatusWord = (typeof STATUS_WORDS)[number];

export interface SpatialStatus {
  id: string;
  name: string;
  status: StatusWord;
  /** One or two plain sentences: what exists, what has not run. */
  detail: string;
  /** Repo evidence for the status word. Shown in docs, not on the page. */
  evidence: string;
}

export const SPATIAL_STATUS: readonly SpatialStatus[] = [
  {
    id: 'phone-ar',
    name: 'Place labels in the phone camera',
    status: 'concept',
    detail: 'Design only. No code places a label on a building yet. The app’s one AR scene is a tabletop game.',
    evidence:
      'No ViroARScene reads HARLEM_PLACE_PREVIEWS; the only AR scene is packages/spatial/TabletopColocationScene.native.tsx (audit §19).',
  },
  {
    id: 'phone-app',
    name: 'The Harlem Might app, iPhone and Android',
    status: 'integration path',
    detail: 'The code is merged and builds. It has not been released.',
    evidence: 'apps/mobile/eas.json: internal distribution only, empty submit.production; no recorded device run (/download).',
  },
  {
    id: 'quest',
    name: 'Meta Quest, immersive scenes',
    status: 'in testing',
    detail: 'Only the floor and controller work. Place labels are not part of it.',
    evidence: 'docs/META_VR_GLASSES.md §5: "In testing on Quest only for the floor and controller work".',
  },
  {
    id: 'meta-vr-glasses',
    name: 'Meta VR Glasses',
    status: 'integration path',
    detail: 'The Quest build is set up to target them. Nothing has run on the glasses.',
    evidence: 'docs/META_VR_GLASSES.md §5: "Status: integration path for glasses"; metaVrGlassesCompatible in apps/mobile/app.config.ts.',
  },
  {
    id: 'snap-specs',
    name: 'Snap Spectacles',
    status: 'preview',
    detail:
      'A scene export for Lens Studio exists on an unmerged branch. Lens Studio would draw everything on the glasses. A web view route is still a concept.',
    evidence:
      'docs/META_VR_GLASSES.md §7: Lens via specs:scene "(preview, branch only)", WebView "(concept)"; viro-external codex/specs-generated-preview b94e5c3.',
  },
  {
    id: 'sightline',
    name: 'Sightline glasses',
    status: 'concept',
    detail: 'A render of hardware that does not exist.',
    evidence: 'packages/spatial/sightline/README.md; procedural geometry only.',
  },
];

/** Sentence-case label for the status column. */
export function statusLabel(word: StatusWord): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
