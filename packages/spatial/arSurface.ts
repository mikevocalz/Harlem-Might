/**
 * The plane fields a surface filter reads. Matches the `ViroAnchor` that
 * `ViroARPlaneSelector`'s `onPlaneDetected` receives.
 */
export interface DetectedPlane {
  readonly type?: string;
  readonly alignment?: string;
  readonly classification?: string;
}

/**
 * Whether a detected plane can hold tabletop content (a game mat, the Harlem
 * diorama). Only horizontal planes qualify.
 *
 * With `requireRoomLabel`, only planes the room model labels `Floor` or
 * `Table` qualify. Pass it on Quest, where planes come from Space Setup and
 * always carry a label; phone AR reports `Unknown`/`None` for most planes, so
 * those are accepted there.
 */
export function acceptsGameSurface(
  plane: DetectedPlane | null | undefined,
  requireRoomLabel: boolean,
): boolean {
  if (plane?.type !== 'plane') return false;
  const alignment = String(plane.alignment ?? '');
  if (alignment && !alignment.includes('Horizontal')) return false;

  const classification = String(plane.classification ?? 'Unknown');
  if (classification === 'Floor' || classification === 'Table') return true;
  if (requireRoomLabel) return false;
  return classification === 'Unknown' || classification === 'None';
}
