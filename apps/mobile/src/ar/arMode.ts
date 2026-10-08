import type { ArMode, ArModeRequest, ArStoreEvent } from '@viro-external/xr-contract';

/** A `mode-degraded` store event, as {@linkcode resolveArMode} reports it. */
export type ModeDegradedEvent = Extract<ArStoreEvent, { type: 'mode-degraded' }>;

/**
 * What the running scene knows when it resolves a mode. Headset facts come
 * from the room model (Space Setup on Quest) after the AR scene mounts.
 */
export interface ArModeFacts {
  /** `headset` has no GNSS (Quest, PICO); `phone` can run street AR. */
  readonly device: 'headset' | 'phone';
  /** Geospatial positioning on this device. Ignored on headsets. */
  readonly geospatial: 'unavailable' | 'gnss-only' | 'vps';
  /** Room-model table the content sits on, when one was found and chosen. */
  readonly tableAnchorId?: string;
  /** Room-model floor, when one was found. */
  readonly floorAnchorId?: string;
  /** Room-model walls; `room` needs at least one plus a floor. */
  readonly wallAnchorIds: readonly string[];
  /** Metres of real world per metre of table, from `fitTabletopScale`. */
  readonly worldToTableScale: number;
  /** Multiplier for landmark radii in `room` mode. */
  readonly roomRadiusScale: number;
}

/** The mode {@linkcode resolveArMode} chose and every downgrade on the way. */
export interface ResolvedArMode {
  readonly mode: ArMode;
  /** Empty when the request resolved as asked. */
  readonly degraded: readonly ModeDegradedEvent[];
}

/**
 * Resolves a requested AR mode against what the device and room support
 * (spec §6A.4/§6A.5).
 *
 * - `street` needs a phone with geospatial positioning. Headsets never get
 *   it; the request falls to `tabletop` with `no-geospatial`.
 * - `room` needs a floor and at least one wall; otherwise `tabletop` with
 *   `no-scene-anchors`.
 * - `tabletop` sits on a table anchor, or on the floor with
 *   `no-table-anchor`. Floor placement is a fallback, not an error.
 */
export function resolveArMode(request: ArModeRequest, facts: ArModeFacts): ResolvedArMode {
  if (request === 'preview') return { mode: { mode: 'preview' }, degraded: [] };

  if (request === 'street') {
    if (facts.device === 'phone' && facts.geospatial !== 'unavailable') {
      return {
        mode: {
          mode: 'street',
          positioning: facts.geospatial === 'vps' ? 'geospatial-vps' : 'geospatial-gnss-only',
        },
        degraded: [],
      };
    }
    return tabletop(request, facts, [degrade(request, 'no-geospatial')]);
  }

  if (request === 'room') {
    if (facts.floorAnchorId !== undefined && facts.wallAnchorIds.length > 0) {
      return {
        mode: {
          mode: 'room',
          wallAnchorIds: facts.wallAnchorIds,
          floorAnchorId: facts.floorAnchorId,
          radiusScale: facts.roomRadiusScale,
        },
        degraded: [],
      };
    }
    return tabletop(request, facts, [degrade(request, 'no-scene-anchors')]);
  }

  return tabletop(request, facts, []);
}

function tabletop(
  request: ArModeRequest,
  facts: ArModeFacts,
  degraded: ModeDegradedEvent[],
): ResolvedArMode {
  if (facts.tableAnchorId !== undefined) {
    return {
      mode: {
        mode: 'tabletop',
        placement: { kind: 'table-anchor', sceneAnchorId: facts.tableAnchorId },
        worldToTableScale: facts.worldToTableScale,
      },
      degraded,
    };
  }
  return {
    mode: { mode: 'tabletop', placement: { kind: 'floor' }, worldToTableScale: facts.worldToTableScale },
    degraded: [...degraded, degrade(request, 'no-table-anchor')],
  };
}

function degrade(requested: ArModeRequest, reason: ModeDegradedEvent['reason']): ModeDegradedEvent {
  return { type: 'mode-degraded', requested, resolved: 'tabletop', reason };
}
