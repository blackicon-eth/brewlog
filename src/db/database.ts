import * as SQLite from "expo-sqlite";
import type { Db } from "./types";
import { SCHEMA_SQL } from "./schema";

let dbPromise: Promise<Db> | null = null;

async function open(): Promise<Db> {
  const db = await SQLite.openDatabaseAsync("brewlog.db");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(SCHEMA_SQL);
  // Forward-migrate installs created before these columns existed. CREATE TABLE IF NOT
  // EXISTS won't alter an existing table, so add new columns here (idempotent: a second
  // run throws "duplicate column name", which we ignore). Older bloom/agitation columns
  // are left in place on existing DBs — harmless, just no longer read or written.
  for (const col of [
    "pours INTEGER", "pour_interval_s INTEGER",
    "method TEXT NOT NULL DEFAULT 'filter'", "preheat INTEGER", "heat TEXT",
  ]) {
    try {
      await db.execAsync(`ALTER TABLE brews ADD COLUMN ${col};`);
    } catch {
      // column already exists
    }
  }
  return db as unknown as Db; // SQLiteDatabase implements the Db subset we use.
}

export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}
