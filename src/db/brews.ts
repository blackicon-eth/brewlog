import type { Db } from "./types";
import type { Brew, BrewRow } from "../models/types";

export function rowToBrew(r: BrewRow): Brew {
  return {
    id: r.id, coffeeId: r.coffee_id, brewedAt: r.brewed_at,
    doseG: r.dose_g, waterG: r.water_g, ratio: r.ratio,
    grind: r.grind, waterTempC: r.water_temp_c, dripper: r.dripper,
    pours: r.pours, pourIntervalS: r.pour_interval_s, totalTimeS: r.total_time_s,
    filterType: r.filter_type, tds: r.tds, ey: r.ey,
    acidity: r.acidity, sweetness: r.sweetness, bitterness: r.bitterness,
    body: r.body, clarity: r.clarity, rating: r.rating, notes: r.notes, createdAt: r.created_at,
  };
}

export async function createBrew(db: Db, b: Brew): Promise<void> {
  await db.runAsync(
    `INSERT INTO brews (id, coffee_id, brewed_at, dose_g, water_g, ratio, grind, water_temp_c,
       dripper, pours, pour_interval_s, total_time_s, filter_type, tds, ey,
       acidity, sweetness, bitterness, body, clarity, rating, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.id, b.coffeeId, b.brewedAt, b.doseG, b.waterG, b.ratio, b.grind ?? null, b.waterTempC ?? null,
     b.dripper ?? null, b.pours ?? null, b.pourIntervalS ?? null, b.totalTimeS ?? null,
     b.filterType ?? null, b.tds ?? null, b.ey ?? null,
     b.acidity ?? null, b.sweetness ?? null, b.bitterness ?? null, b.body ?? null,
     b.clarity ?? null, b.rating ?? null, b.notes ?? null, b.createdAt]
  );
}

export async function listBrewsForCoffee(db: Db, coffeeId: string): Promise<Brew[]> {
  const rows = await db.getAllAsync<BrewRow>(
    "SELECT * FROM brews WHERE coffee_id = ? ORDER BY brewed_at DESC", [coffeeId]
  );
  return rows.map(rowToBrew);
}

// A brew paired with the identity of the coffee it belongs to — for the global brew
// ledger, where brews from every coffee are interleaved and need a label.
export type BrewWithCoffee = Brew & { roaster: string; coffeeName: string };

// Newest-first across all coffees. `id DESC` is a stable tiebreaker for brews sharing the
// same `brewed_at` (times are often minute-precision), giving a total order so LIMIT/OFFSET
// paging never skips or repeats a row. Omit `limit` to fetch everything.
export async function listAllBrews(
  db: Db,
  opts: { limit?: number; offset?: number } = {}
): Promise<BrewWithCoffee[]> {
  let sql = `SELECT b.*, c.roaster AS c_roaster, c.name AS c_name
       FROM brews b JOIN coffees c ON c.id = b.coffee_id
       ORDER BY b.brewed_at DESC, b.id DESC`;
  const params: number[] = [];
  if (opts.limit != null) {
    sql += " LIMIT ? OFFSET ?";
    params.push(opts.limit, opts.offset ?? 0);
  }
  const rows = await db.getAllAsync<BrewRow & { c_roaster: string; c_name: string }>(sql, params);
  return rows.map((r) => ({ ...rowToBrew(r), roaster: r.c_roaster, coffeeName: r.c_name }));
}

export async function countAllBrews(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM brews");
  return row?.n ?? 0;
}

export async function getBrew(db: Db, id: string): Promise<Brew | null> {
  const row = await db.getFirstAsync<BrewRow>("SELECT * FROM brews WHERE id = ?", [id]);
  return row ? rowToBrew(row) : null;
}

export async function updateBrew(db: Db, b: Brew): Promise<void> {
  await db.runAsync(
    `UPDATE brews SET brewed_at=?, dose_g=?, water_g=?, ratio=?, grind=?, water_temp_c=?, dripper=?,
       pours=?, pour_interval_s=?, total_time_s=?, filter_type=?, tds=?, ey=?,
       acidity=?, sweetness=?, bitterness=?, body=?, clarity=?, rating=?, notes=?
     WHERE id = ?`,
    [b.brewedAt, b.doseG, b.waterG, b.ratio, b.grind ?? null, b.waterTempC ?? null, b.dripper ?? null,
     b.pours ?? null, b.pourIntervalS ?? null, b.totalTimeS ?? null,
     b.filterType ?? null, b.tds ?? null, b.ey ?? null, b.acidity ?? null, b.sweetness ?? null,
     b.bitterness ?? null, b.body ?? null, b.clarity ?? null, b.rating ?? null, b.notes ?? null, b.id]
  );
}

export async function deleteBrew(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM brews WHERE id = ?", [id]);
}

export function avgRating(brews: Brew[]): number | null {
  const rated = brews.filter((b) => b.rating != null) as (Brew & { rating: number })[];
  if (rated.length === 0) return null;
  return rated.reduce((s, b) => s + b.rating, 0) / rated.length;
}
