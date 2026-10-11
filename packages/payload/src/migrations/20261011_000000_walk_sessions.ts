import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres';
import { WALK_SESSIONS_SCHEMA_SQL } from '../walk-sessions/schema.ts';

/** Scoped additive migration; it neither alters auth tables nor changes account FKs. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(WALK_SESSIONS_SCHEMA_SQL));
}

/** Destructive rollback: only run with an explicit retention/backup decision. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE "payload"."walk_sessions";`);
}
