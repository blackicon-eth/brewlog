import type { Db } from "./types";
import type { Coffee, CoffeeRow } from "../models/types";

export function rowToCoffee(r: CoffeeRow): Coffee {
  return {
    id: r.id, roaster: r.roaster, name: r.name, origin: r.origin, process: r.process,
    roastLevel: r.roast_level, roastDate: r.roast_date, notes: r.notes, createdAt: r.created_at,
  };
}

export async function createCoffee(db: Db, c: Coffee): Promise<void> {
  await db.runAsync(
    `INSERT INTO coffees (id, roaster, name, origin, process, roast_level, roast_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.id, c.roaster, c.name, c.origin ?? null, c.process ?? null, c.roastLevel ?? null,
     c.roastDate ?? null, c.notes ?? null, c.createdAt]
  );
}

export async function listCoffees(db: Db): Promise<Coffee[]> {
  const rows = await db.getAllAsync<CoffeeRow>("SELECT * FROM coffees ORDER BY created_at DESC");
  return rows.map(rowToCoffee);
}

export async function getCoffee(db: Db, id: string): Promise<Coffee | null> {
  const row = await db.getFirstAsync<CoffeeRow>("SELECT * FROM coffees WHERE id = ?", [id]);
  return row ? rowToCoffee(row) : null;
}

export async function updateCoffee(db: Db, c: Coffee): Promise<void> {
  await db.runAsync(
    `UPDATE coffees SET roaster=?, name=?, origin=?, process=?, roast_level=?, roast_date=?, notes=?
     WHERE id = ?`,
    [c.roaster, c.name, c.origin ?? null, c.process ?? null, c.roastLevel ?? null,
     c.roastDate ?? null, c.notes ?? null, c.id]
  );
}

export async function deleteCoffee(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM coffees WHERE id = ?", [id]);
}
