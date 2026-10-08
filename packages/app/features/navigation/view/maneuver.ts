import type { NavigationManeuver, RouteStep } from '../model/route.ts';

/**
 * The arrow a maneuver is drawn with. One glyph per direction the person
 * acts on, so the map HUD, the step list and (later) the AR turn badge use
 * the same mark for the same maneuver.
 */
export type ManeuverGlyph =
  | 'depart'
  | 'straight'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'uturn'
  | 'roundabout'
  | 'arrive';

/** Picks the glyph for a maneuver from its type, then its modifier. */
export function maneuverGlyph(maneuver: Pick<NavigationManeuver, 'type' | 'modifier'>): ManeuverGlyph {
  switch (maneuver.type) {
    case 'depart':
      return 'depart';
    case 'arrive':
      return 'arrive';
    case 'roundabout':
    case 'rotary':
    case 'roundabout-turn':
    case 'exit-roundabout':
    case 'exit-rotary':
      return 'roundabout';
    default:
      return maneuver.modifier ?? 'straight';
  }
}

/** Words for each glyph, for screen readers when the instruction text is not read with it. */
export const GLYPH_LABEL: Readonly<Record<ManeuverGlyph, string>> = {
  depart: 'Start',
  straight: 'Continue straight',
  'slight-left': 'Bear left',
  left: 'Turn left',
  'sharp-left': 'Sharp left',
  'slight-right': 'Bear right',
  right: 'Turn right',
  'sharp-right': 'Sharp right',
  uturn: 'Turn around',
  roundabout: 'Roundabout',
  arrive: 'Arrive',
};

/**
 * The instruction to show for a step. Mapbox writes complete sentences
 * ("Turn right onto West 126th Street."); when a provider sends none, the
 * glyph's words plus the street stand in, so no row is ever blank.
 */
export function stepInstruction(step: Pick<RouteStep, 'maneuver' | 'name'>): string {
  const text = step.maneuver.instruction.trim();
  if (text) return text;
  const base = GLYPH_LABEL[maneuverGlyph(step.maneuver)];
  return step.name ? `${base} onto ${step.name}` : base;
}

/**
 * The street a step walks along, or a plain description for the unnamed
 * paths Mapbox leaves blank (crosswalks, plazas, park paths).
 */
export function streetLabel(name: string): string {
  return name.trim() || 'Unnamed path';
}
