import * as walkSessions from './20261011_000000_walk_sessions.ts';

export const migrations = [{
  name: '20261011_000000_walk_sessions',
  up: walkSessions.up,
  down: walkSessions.down,
}];
