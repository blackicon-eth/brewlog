import * as SQLite from "expo-sqlite";
import type { Db } from "./types";
import { SCHEMA_SQL } from "./schema";

let dbPromise: Promise<Db> | null = null;

async function open(): Promise<Db> {
  const db = await SQLite.openDatabaseAsync("brewlog.db");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(SCHEMA_SQL);
  return db as unknown as Db; // SQLiteDatabase implements the Db subset we use.
}

export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}
