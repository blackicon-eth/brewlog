import type { Db } from "./types";
import type { Coffee, CoffeeRow } from "../models/types";

export function rowToCoffee(r: CoffeeRow): Coffee {
  return {
    id: r.id, roaster: r.roaster, name: r.name, origin: r.origin, process: r.process,
    roastLevel: r.roast_level, roastDate: r.roast_date, notes: r.notes,
    archived: r.archived === 1, createdAt: r.created_at,
  };
}

export async function createCoffee(db: Db, c: Coffee): Promise<void> {
  await db.runAsync(
    `INSERT INTO coffees (id, roaster, name, origin, process, roast_level, roast_date, notes, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.id, c.roaster, c.name, c.origin ?? null, c.process ?? null, c.roastLevel ?? null,
     c.roastDate ?? null, c.notes ?? null, c.archived ? 1 : 0, c.createdAt]
  );
}

export async function listCoffees(db: Db): Promise<Coffee[]> {
  const rows = await db.getAllAsync<CoffeeRow>("SELECT * FROM coffees ORDER BY created_at DESC");
  return rows.map(rowToCoffee);
}

// A coffee enriched with its brew aggregates — the read model for the Coffees shelf, so
// the list renders counts, average ratings, and last-brewed date without an N+1 fetch per card.
export type CoffeeWithStats = Coffee & {
  brewCount: number; avg: number | null; lastBrewedAt: number | null; coverPhotoUri: string | null;
};

// One aggregate pass: every coffee with its brew count, mean rating, and most recent brew
// date. LEFT JOIN keeps brew-less coffees; COUNT(b.id) (not COUNT(*)) yields 0 for them
// rather than counting the null-joined row; AVG(rating) ignores NULL ratings and is NULL
// when there are none — matching avgRating(); MAX(brewed_at) is likewise NULL for a
// brew-less coffee. coverPhotoUri is the position-0 photo (or null when none), fetched
// via a correlated subquery so the query stays a single pass. Ordered by last use:
// brewed coffees first, most recently brewed on top — brewing is the only thing that
// earns the top of the shelf — then the never-brewed bags, newest-added first.
export async function listCoffeesWithStats(db: Db): Promise<CoffeeWithStats[]> {
  const rows = await db.getAllAsync<
    CoffeeRow & {
      brew_count: number; avg_rating: number | null; last_brewed_at: number | null;
      cover_photo_uri: string | null;
    }
  >(
    `SELECT c.*, COUNT(b.id) AS brew_count, AVG(b.rating) AS avg_rating, MAX(b.brewed_at) AS last_brewed_at,
            (SELECT uri FROM coffee_photos p WHERE p.coffee_id = c.id ORDER BY p.position LIMIT 1) AS cover_photo_uri
       FROM coffees c LEFT JOIN brews b ON b.coffee_id = c.id
      GROUP BY c.id
      ORDER BY MAX(b.brewed_at) IS NULL, MAX(b.brewed_at) DESC, c.created_at DESC`
  );
  return rows.map((r) => ({
    ...rowToCoffee(r), brewCount: r.brew_count, avg: r.avg_rating, lastBrewedAt: r.last_brewed_at,
    coverPhotoUri: r.cover_photo_uri,
  }));
}

export async function getCoffee(db: Db, id: string): Promise<Coffee | null> {
  const row = await db.getFirstAsync<CoffeeRow>("SELECT * FROM coffees WHERE id = ?", [id]);
  return row ? rowToCoffee(row) : null;
}

export async function updateCoffee(db: Db, c: Coffee): Promise<void> {
  await db.runAsync(
    `UPDATE coffees SET roaster=?, name=?, origin=?, process=?, roast_level=?, roast_date=?, notes=?, archived=?
     WHERE id = ?`,
    [c.roaster, c.name, c.origin ?? null, c.process ?? null, c.roastLevel ?? null,
     c.roastDate ?? null, c.notes ?? null, c.archived ? 1 : 0, c.id]
  );
}

// Flip just the archived flag — used by the edit page's archive/restore toggle, which
// takes effect immediately without rewriting the rest of the coffee.
export async function setCoffeeArchived(db: Db, id: string, archived: boolean): Promise<void> {
  await db.runAsync("UPDATE coffees SET archived=? WHERE id = ?", [archived ? 1 : 0, id]);
}

export async function deleteCoffee(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM coffees WHERE id = ?", [id]);
}
