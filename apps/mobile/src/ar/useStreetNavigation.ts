import type { StreetNavigationCommands, StreetNavigationPort } from './streetNavigationPort';

const notWired = (): never => {
  throw new Error('Street navigation is not wired to the NavigationSession yet');
};

const UNWIRED_COMMANDS: StreetNavigationCommands = {
  requestRoute: notWired,
  start: notWired,
  goToStep: notWired,
  end: notWired,
};

const UNWIRED: StreetNavigationPort = {
  view: {
    status: 'unavailable',
    reason: 'Turn-by-turn arrives with the shared navigation session',
  },
  commands: UNWIRED_COMMANDS,
};

/**
 * The street scene's view of the shared NavigationSession. Until that store
 * lands (packages/app/features/navigation), it reports `unavailable` and the
 * scene shows no route controls; the commands throw if anything calls them.
 * Wiring it is this one hook: select the view from the session store and
 * pass its actions as the commands.
 */
export function useStreetNavigation(): StreetNavigationPort {
  return UNWIRED;
}
