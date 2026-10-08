/**
 * Whether Place Detail offers "View on a table". Needs the quest build (the
 * immersive activity is compiled in), the Meta Horizon runtime, and a place
 * with coordinates. Passthrough and the room model can only be checked after
 * the AR scene mounts, so the scene reports those itself.
 */
export function canViewInAr(input: {
  readonly isHorizonBuild: boolean;
  readonly isMetaHorizonXR: boolean;
  readonly place: { readonly id: string; readonly lngLat?: readonly [number, number] } | undefined;
}): boolean {
  return input.isHorizonBuild && input.isMetaHorizonXR && input.place?.lngLat !== undefined;
}
