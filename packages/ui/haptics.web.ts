/** Web fork — no haptics on the web platform; calls are free no-ops. */
export const haptics = {
  tap: () => undefined,
  success: () => undefined,
  warning: () => undefined,
  selection: () => undefined,
  walkStarted: () => undefined,
  approachingTurn: () => undefined,
  landmarkNearby: () => undefined,
  arrived: () => undefined,
  stopConfirmed: () => undefined,
  tourCompleted: () => undefined,
  routeChanged: () => undefined,
  setEnabled: (_state: boolean) => undefined,
  setForeground: (_state: boolean) => undefined,
};
