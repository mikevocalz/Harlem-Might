import type { StoredWalkSession, WalkSessionRepository } from './service.ts';

/** Small pg-compatible boundary, injectable for real SQL integration tests. */
export interface WalkSessionSQL {
  query(text: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * No Payload read-then-update: the final write must include the original generation.
 * SQL names are fixed, all values are bound, and every query includes the verified owner.
 */
export function createWalkSessionRepository(database: WalkSessionSQL): WalkSessionRepository {
  return {
    async read(memberId, sessionId) {
      const { rows } = await database.query(
        'SELECT member_id, snapshot, generation, receipts FROM payload.walk_sessions WHERE owner_key = $1 AND member_id = $2',
        [`${memberId}:${sessionId}`, memberId],
      );
      const row = rows[0];
      return row ? {
        memberId: Number(row.member_id), session: row.snapshot,
        generation: Number(row.generation), receipts: row.receipts,
      } as StoredWalkSession : null;
    },
    async insert(record) {
      const { rows } = await database.query(
        `INSERT INTO payload.walk_sessions (owner_key, member_id, snapshot, generation, receipts)
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)
         ON CONFLICT (owner_key) DO NOTHING RETURNING id`,
        [`${record.memberId}:${record.session.sessionId}`, record.memberId, JSON.stringify(record.session),
          record.generation, JSON.stringify(record.receipts)],
      );
      return rows.length === 1;
    },
    async compareAndSwap(record, expectedGeneration) {
      const { rows } = await database.query(
        `UPDATE payload.walk_sessions SET snapshot = $1::jsonb, generation = $2, receipts = $3::jsonb
         WHERE owner_key = $4 AND member_id = $5 AND generation = $6 RETURNING id`,
        [JSON.stringify(record.session), record.generation, JSON.stringify(record.receipts),
          `${record.memberId}:${record.session.sessionId}`, record.memberId, expectedGeneration],
      );
      return rows.length === 1;
    },
  };
}
