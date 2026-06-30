import type { Db } from "./types";
import type { Brew, BrewRow } from "../models/types";

export function rowToBrew(r: BrewRow): Brew {
  return {
    id: r.id, coffeeId: r.coffee_id, brewedAt: r.brewed_at,
    doseG: r.dose_g, waterG: r.water_g, ratio: r.ratio,
    grind: r.grind, waterTempC: r.water_temp_c, dripper: r.dripper,
    bloomWaterG: r.bloom_water_g, bloomTimeS: r.bloom_time_s, totalTimeS: r.total_time_s,
    agitation: r.agitation, filterType: r.filter_type, tds: r.tds, ey: r.ey,
    acidity: r.acidity, sweetness: r.sweetness, bitterness: r.bitterness,
    body: r.body, clarity: r.clarity, rating: r.rating, notes: r.notes, createdAt: r.created_at,
  };
}

export async function createBrew(db: Db, b: Brew): Promise<void> {
  await db.runAsync(
    `INSERT INTO brews (id, coffee_id, brewed_at, dose_g, water_g, ratio, grind, water_temp_c,
       dripper, bloom_water_g, bloom_time_s, total_time_s, agitation, filter_type, tds, ey,
       acidity, sweetness, bitterness, body, clarity, rating, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.id, b.coffeeId, b.brewedAt, b.doseG, b.waterG, b.ratio, b.grind ?? null, b.waterTempC ?? null,
     b.dripper ?? null, b.bloomWaterG ?? null, b.bloomTimeS ?? null, b.totalTimeS ?? null,
     b.agitation ?? null, b.filterType ?? null, b.tds ?? null, b.ey ?? null,
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

export async function getBrew(db: Db, id: string): Promise<Brew | null> {
  const row = await db.getFirstAsync<BrewRow>("SELECT * FROM brews WHERE id = ?", [id]);
  return row ? rowToBrew(row) : null;
}

export async function updateBrew(db: Db, b: Brew): Promise<void> {
  await db.runAsync(
    `UPDATE brews SET brewed_at=?, dose_g=?, water_g=?, ratio=?, grind=?, water_temp_c=?, dripper=?,
       bloom_water_g=?, bloom_time_s=?, total_time_s=?, agitation=?, filter_type=?, tds=?, ey=?,
       acidity=?, sweetness=?, bitterness=?, body=?, clarity=?, rating=?, notes=?
     WHERE id = ?`,
    [b.brewedAt, b.doseG, b.waterG, b.ratio, b.grind ?? null, b.waterTempC ?? null, b.dripper ?? null,
     b.bloomWaterG ?? null, b.bloomTimeS ?? null, b.totalTimeS ?? null, b.agitation ?? null,
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
