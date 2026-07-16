import type { Db } from "./types";
import type { Recipe, RecipeRow } from "../models/types";
import { methodSpec, methodFilterSql, type BrewMethodId } from "../lib/brewMethods";

// methodSpec normalizes unknown/legacy ids (e.g. "v60") to "filter", matching brews.
function rowToRecipe(r: RecipeRow): Recipe {
  return {
    coffeeId: r.coffee_id,
    method: methodSpec(r.method).id,
    doseG: r.dose_g,
    waterG: r.water_g,
    grind: r.grind,
    waterTempC: r.water_temp_c,
    notes: r.notes,
    updatedAt: r.updated_at,
  };
}

export async function upsertRecipe(db: Db, r: Recipe): Promise<void> {
  await db.runAsync(
    `INSERT INTO recipes (coffee_id, method, dose_g, water_g, grind, water_temp_c, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(coffee_id, method) DO UPDATE SET
       dose_g = excluded.dose_g, water_g = excluded.water_g, grind = excluded.grind,
       water_temp_c = excluded.water_temp_c, notes = excluded.notes, updated_at = excluded.updated_at`,
    [r.coffeeId, r.method, r.doseG, r.waterG, r.grind, r.waterTempC, r.notes, r.updatedAt]
  );
}

export async function getRecipe(db: Db, coffeeId: string, method: BrewMethodId): Promise<Recipe | null> {
  const { clause, params } = methodFilterSql(method);
  const row = await db.getFirstAsync<RecipeRow>(
    `SELECT * FROM recipes WHERE coffee_id = ? AND ${clause}`,
    [coffeeId, ...params]
  );
  return row ? rowToRecipe(row) : null;
}

export async function listRecipes(db: Db, coffeeId: string): Promise<Recipe[]> {
  const rows = await db.getAllAsync<RecipeRow>(
    "SELECT * FROM recipes WHERE coffee_id = ? ORDER BY method ASC", [coffeeId]
  );
  return rows.map(rowToRecipe);
}

export async function listAllRecipes(db: Db): Promise<Recipe[]> {
  const rows = await db.getAllAsync<RecipeRow>("SELECT * FROM recipes ORDER BY coffee_id, method ASC");
  return rows.map(rowToRecipe);
}

export async function deleteRecipe(db: Db, coffeeId: string, method: BrewMethodId): Promise<void> {
  await db.runAsync("DELETE FROM recipes WHERE coffee_id = ? AND method = ?", [coffeeId, method]);
}
