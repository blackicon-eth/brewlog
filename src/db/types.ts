export type SqlParams = ReadonlyArray<string | number | null>;

// Subset of expo-sqlite's SQLiteDatabase the app uses. better-sqlite3 adapter
// (tests) and the real expo-sqlite db (device) both implement this.
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParams): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null>;
}
