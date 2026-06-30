import Database from "better-sqlite3";
import type { Db, SqlParams } from "./types";
import { SCHEMA_SQL } from "./schema";

// Wraps a synchronous better-sqlite3 in-memory DB behind the async Db interface.
export async function makeTestDb(): Promise<Db> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);
  const args = (p?: SqlParams) => (p ? [...p] : []);
  return {
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, params) {
      const info = sqlite.prepare(sql).run(...args(params));
      return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
    },
    async getAllAsync<T>(sql: string, params?: SqlParams) {
      return sqlite.prepare(sql).all(...args(params)) as T[];
    },
    async getFirstAsync<T>(sql: string, params?: SqlParams) {
      return (sqlite.prepare(sql).get(...args(params)) as T) ?? null;
    },
  };
}
