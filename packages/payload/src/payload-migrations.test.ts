import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { readMigrationFiles } from 'payload';
import type { Payload } from 'payload';
import ts from 'typescript';

const configPath = fileURLToPath(new URL('./payload.config.ts', import.meta.url));
const dirname = path.dirname(configPath);
const repositoryRoot = path.resolve(dirname, '../../..');

function configuredAdapter(): ReturnType<typeof postgresAdapter> {
  // Evaluate only the application's actual database configuration. Importing the
  // whole config would also load auth/storage plugins and their environment.
  const source = ts.createSourceFile(configPath, readFileSync(configPath, 'utf8'), ts.ScriptTarget.Latest, true);
  const exported = source.statements.find(ts.isExportAssignment);
  assert.ok(exported && ts.isCallExpression(exported.expression));
  const config = exported.expression.arguments[0];
  assert.ok(config && ts.isObjectLiteralExpression(config));
  const database = config.properties.find((property) =>
    ts.isPropertyAssignment(property) && property.name.getText(source) === 'db');
  assert.ok(database && ts.isPropertyAssignment(database));
  assert.ok(ts.isCallExpression(database.initializer));
  assert.equal(database.initializer.expression.getText(source), 'postgresAdapter');
  return runInNewContext(database.initializer.getText(source), {
    postgresAdapter, path, dirname, process: { env: {} },
  }) as ReturnType<typeof postgresAdapter>;
}

test('configured Payload migrations are discoverable independently of the CLI working directory', async (t) => {
  for (const workingDirectory of [repositoryRoot, path.join(repositoryRoot, 'apps/web')]) {
    await t.test(path.relative(repositoryRoot, workingDirectory) || 'repository root', async () => {
      const previousDirectory = process.cwd();
      try {
        process.chdir(workingDirectory);
        const payload = {
          logger: {
            info: () => {},
            error: (error: unknown) => assert.fail(JSON.stringify(error)),
          },
        } as unknown as Payload;
        // Adapter construction resolves migrationDir but does not initialize a
        // database or create a pool. Never call Payload.init or a migration.
        payload.db = configuredAdapter().init({ payload }) as unknown as Payload['db'];
        const forbidDatabase = () => { throw new Error('Database access is forbidden in discovery tests'); };
        payload.db.connect = forbidDatabase;
        payload.db.execute = forbidDatabase;
        payload.db.migrate = forbidDatabase;
        assert.equal(payload.db.pool, undefined);
        assert.equal(payload.db.migrationDir, path.resolve(dirname, 'migrations'));

        const migrations = await readMigrationFiles({ payload });
        const walkSessions = migrations.find(({ name }) => name === '20261011_000000_walk_sessions');
        assert.ok(walkSessions, 'the checked-in walk-session migration is discovered');
        assert.equal(typeof walkSessions.up, 'function');
        assert.equal(typeof walkSessions.down, 'function');
        const usersApiKeys = migrations.find(({ name }) => name === '20261012_152659_users_api_keys');
        assert.ok(usersApiKeys, 'the checked-in user API-key migration is discovered');
        assert.equal(typeof usersApiKeys.up, 'function');
        assert.equal(typeof usersApiKeys.down, 'function');
        assert.ok(migrations.every(({ name }) => name !== 'index'));
        assert.equal(payload.db.pool, undefined);
      } finally {
        process.chdir(previousDirectory);
      }
    });
  }
});
