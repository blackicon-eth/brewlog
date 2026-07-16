import type { Db } from "./types";
import type { CoffeePhoto, CoffeePhotoRow } from "../models/types";

function rowToPhoto(r: CoffeePhotoRow): CoffeePhoto {
  return { id: r.id, coffeeId: r.coffee_id, uri: r.uri, position: r.position, createdAt: r.created_at };
}

export async function createCoffeePhoto(db: Db, p: CoffeePhoto): Promise<void> {
  await db.runAsync(
    "INSERT INTO coffee_photos (id, coffee_id, uri, position, created_at) VALUES (?, ?, ?, ?, ?)",
    [p.id, p.coffeeId, p.uri, p.position, p.createdAt]
  );
}

export async function listPhotosForCoffee(db: Db, coffeeId: string): Promise<CoffeePhoto[]> {
  const rows = await db.getAllAsync<CoffeePhotoRow>(
    "SELECT * FROM coffee_photos WHERE coffee_id = ? ORDER BY position ASC", [coffeeId]
  );
  return rows.map(rowToPhoto);
}

export async function listAllPhotos(db: Db): Promise<CoffeePhoto[]> {
  const rows = await db.getAllAsync<CoffeePhotoRow>(
    "SELECT * FROM coffee_photos ORDER BY coffee_id, position ASC"
  );
  return rows.map(rowToPhoto);
}

export async function deleteCoffeePhoto(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM coffee_photos WHERE id = ?", [id]);
}

export async function updateCoffeePhotoPosition(db: Db, id: string, position: number): Promise<void> {
  await db.runAsync("UPDATE coffee_photos SET position = ? WHERE id = ?", [position, id]);
}
