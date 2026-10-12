import * as walkSessions from './20261011_000000_walk_sessions.ts';
import * as migration_20261012_152659_users_api_keys from './20261012_152659_users_api_keys';

export const migrations = [
  {
    name: '20261011_000000_walk_sessions',
    up: walkSessions.up,
    down: walkSessions.down,
  },
  {
    up: migration_20261012_152659_users_api_keys.up,
    down: migration_20261012_152659_users_api_keys.down,
    name: '20261012_152659_users_api_keys'
  },
];
