import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."users"
      ADD COLUMN "api_key" varchar,
      ADD COLUMN "api_key_last4" varchar,
      ADD COLUMN "api_key_index" varchar;
    ALTER TABLE "payload"."_users_v"
      ADD COLUMN "version_api_key" varchar,
      ADD COLUMN "version_api_key_last4" varchar,
      ADD COLUMN "version_api_key_index" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."_users_v"
      DROP COLUMN "version_api_key",
      DROP COLUMN "version_api_key_last4",
      DROP COLUMN "version_api_key_index";
    ALTER TABLE "payload"."users"
      DROP COLUMN "api_key",
      DROP COLUMN "api_key_last4",
      DROP COLUMN "api_key_index";
  `)
}
