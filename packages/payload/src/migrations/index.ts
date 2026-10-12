import * as migration_20261012_152659_users_api_keys from './20261012_152659_users_api_keys';

export const migrations = [
  {
    up: migration_20261012_152659_users_api_keys.up,
    down: migration_20261012_152659_users_api_keys.down,
    name: '20261012_152659_users_api_keys'
  },
];
