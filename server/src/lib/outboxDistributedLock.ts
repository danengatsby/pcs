import type { PoolClient } from "pg";
import { pool } from "./db.js";
import { appLogger } from "./logger.js";

export async function withOutboxDistributedLock<T>(
  lockName: string,
  runner: () => Promise<T>
): Promise<T | null> {
  const client: PoolClient = await pool.connect();
  let acquired = false;

  try {
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [lockName]
    );
    acquired = result.rows[0]?.acquired === true;

    if (!acquired) {
      return null;
    }

    return await runner();
  } finally {
    if (acquired) {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]);
      } catch (error) {
        appLogger.error({ err: error, lockName }, "Failed to release outbox lock");
      }
    }
    client.release();
  }
}
