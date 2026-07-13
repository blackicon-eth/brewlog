// CREATE statements only. Foreign-key enforcement is enabled per-connection
// at runtime (PRAGMA foreign_keys = ON) in database.ts and testdb.ts.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS coffees (
  id TEXT PRIMARY KEY NOT NULL,
  roaster TEXT NOT NULL,
  name TEXT NOT NULL,
  origin TEXT,
  process TEXT,
  roast_level TEXT,
  roast_date TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS brews (
  id TEXT PRIMARY KEY NOT NULL,
  coffee_id TEXT NOT NULL REFERENCES coffees(id) ON DELETE CASCADE,
  brewed_at INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'filter',
  dose_g REAL NOT NULL,
  water_g REAL NOT NULL,
  ratio REAL NOT NULL,
  grind TEXT,
  water_temp_c REAL,
  dripper TEXT,
  pours INTEGER,
  pour_interval_s INTEGER,
  total_time_s INTEGER,
  filter_type TEXT,
  preheat INTEGER,
  heat TEXT,
  acidity INTEGER,
  sweetness INTEGER,
  bitterness INTEGER,
  body INTEGER,
  clarity INTEGER,
  rating INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brews_coffee ON brews(coffee_id, brewed_at DESC);
`;
