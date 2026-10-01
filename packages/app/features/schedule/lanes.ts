import { eventsOverlap, type ScheduleEvent } from './model.ts';

export interface LaidOutEvent {
  event: ScheduleEvent;
  /** 0-based lane within the column. */
  lane: number;
  /** How many lanes the event's cluster is divided into. */
  laneCount: number;
}

/**
 * Assign concurrent events to lanes within a single resource column.
 *
 * Two-stage, because the naive one-pass version gets the WIDTH wrong even when
 * it gets the lane right:
 *
 *   1. Sweep events in start order into the first lane that is free, which is
 *      the classic interval-graph greedy colouring.
 *   2. Group events into transitively-connected clusters and give every event
 *      in a cluster the SAME `laneCount`.
 *
 * Stage 2 is the part that matters. Consider a long event spanning two short
 * ones that do not touch each other: the short ones are only pairwise
 * concurrent with the long one, so a per-event maximum would size them as if
 * the column were split two ways at one moment and two ways at another, and
 * the blocks would not line up. Sizing by cluster makes the whole overlapping
 * run share one column division.
 *
 * Events are not mutated and the input order is not relied upon.
 */
export function assignLanes(events: readonly ScheduleEvent[]): LaidOutEvent[] {
  if (events.length === 0) {
    return [];
  }

  const ordered = [...events].sort((a, b) => {
    const byStart = a.start.getTime() - b.start.getTime();
    if (byStart !== 0) return byStart;
    // Longest first on a tie, so the spanning event takes the leading lane.
    return b.end.getTime() - a.end.getTime();
  });

  // Stage 1 — greedy lane assignment.
  const laneEndTimes: number[] = [];
  const lanes = new Map<string, number>();

  for (const event of ordered) {
    let lane = laneEndTimes.findIndex((endsAt) => endsAt <= event.start.getTime());
    if (lane === -1) {
      lane = laneEndTimes.length;
    }
    laneEndTimes[lane] = event.end.getTime();
    lanes.set(event.id, lane);
  }

  // Stage 2 — cluster by transitive overlap, then size by cluster.
  const clusterOf = new Map<string, number>();
  let clusterCount = 0;

  for (const event of ordered) {
    if (clusterOf.has(event.id)) continue;

    const cluster = clusterCount++;
    const queue = [event];
    clusterOf.set(event.id, cluster);

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) break;
      for (const other of ordered) {
        if (clusterOf.has(other.id)) continue;
        if (eventsOverlap(current, other)) {
          clusterOf.set(other.id, cluster);
          queue.push(other);
        }
      }
    }
  }

  const clusterLaneCount = new Array<number>(clusterCount).fill(0);
  for (const event of ordered) {
    const cluster = clusterOf.get(event.id) ?? 0;
    const lane = lanes.get(event.id) ?? 0;
    clusterLaneCount[cluster] = Math.max(clusterLaneCount[cluster] ?? 0, lane + 1);
  }

  return ordered.map((event) => ({
    event,
    lane: lanes.get(event.id) ?? 0,
    laneCount: clusterLaneCount[clusterOf.get(event.id) ?? 0] ?? 1,
  }));
}

/** Group a day's events by resource, preserving resource order. */
export function lanesByResource(
  events: readonly ScheduleEvent[],
  resourceIds: readonly string[],
): Map<string, LaidOutEvent[]> {
  const byResource = new Map<string, LaidOutEvent[]>();
  for (const resourceId of resourceIds) {
    byResource.set(
      resourceId,
      assignLanes(events.filter((event) => event.resourceId === resourceId)),
    );
  }
  return byResource;
}
