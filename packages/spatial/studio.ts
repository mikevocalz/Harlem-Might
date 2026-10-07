/**
 * This app's link to its ReactVision Studio project (`harlem-might`).
 *
 * The project id and API key are public client values — `EXPO_PUBLIC_*`
 * lands in the bundle — read here once so no screen ever names an env var.
 * On native the Expo config plugin bakes the same pair into the manifest for
 * `VRTStudioModule`, so `StudioSceneNavigator` needs no props to fetch. On web
 * there is no manifest; the fetch in `StudioExperience.web` sends the same
 * `x-api-key` header the native module sends.
 *
 * `studioConfigured` is false until both values exist, and callers render the
 * code-first scene in that case — Studio content is additive, never the only
 * way a scene exists.
 */

/* Static `process.env.X` reads only: Expo inlines EXPO_PUBLIC_* by literal
   name, so a dynamic `process.env[name]` would read undefined at runtime. */
export const STUDIO_PROJECT_ID = process.env.EXPO_PUBLIC_REACTVISION_PROJECT_ID || null;
export const STUDIO_ENDPOINT =
  process.env.EXPO_PUBLIC_REACTVISION_ENDPOINT || 'https://platform.reactvision.xyz';
const STUDIO_API_KEY = process.env.EXPO_PUBLIC_REACTVISION_API_KEY || null;

export const studioConfigured = STUDIO_PROJECT_ID !== null && STUDIO_API_KEY !== null;

/** Headers for web scene fetches — the same contract VRTStudioModule uses natively. */
export function studioRequestHeaders(): Record<string, string> {
  return STUDIO_API_KEY ? { 'x-api-key': STUDIO_API_KEY } : {};
}

/**
 * Local scene key → Studio scene UUID. An entry stays null while the scene
 * has no Studio counterpart — for scenes built on things Studio cannot
 * author (game loops, co-location, replicated state, native Rive/Three.js
 * surfaces) that is the permanent answer, and the repository remains their
 * source of truth. Set a scene's UUID here once it is authored in the Studio
 * project; `StudioExperience` picks it up with no other change.
 */
export const STUDIO_SCENES = {
  'grid-race': { studioSceneId: null },
  'tabletop-colocation': { studioSceneId: null },
  'external-panels': { studioSceneId: null },
} satisfies Record<string, { studioSceneId: string | null }>;

export type StudioSceneKey = keyof typeof STUDIO_SCENES;

/**
 * The Studio scene id a registry key resolves to, or null when the local
 * scene is the one to run — an unmapped key or an unconfigured project both
 * mean code-first.
 */
export function studioSceneId(key: StudioSceneKey): string | null {
  if (!studioConfigured) return null;
  return STUDIO_SCENES[key].studioSceneId;
}
