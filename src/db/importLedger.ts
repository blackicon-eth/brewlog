import type { Db } from "./types";
import type { Coffee, Brew, CoffeePhoto, Recipe } from "../models/types";
import { createCoffee } from "./coffees";
import { createBrew } from "./brews";
import { createCoffeePhoto } from "./coffeePhotos";
import { upsertRecipe } from "./recipes";

// Replaces the entire ledger with the payload inside one transaction: a failure at
// any point rolls back to the pre-import state, so a poisoned file can't leave the
// user with half a ledger.
export async function replaceLedger(
  db: Db,
  payload: { coffees: Coffee[]; brews: Brew[]; photos?: CoffeePhoto[]; recipes?: Recipe[] }
): Promise<void> {
  await db.execAsync("BEGIN");
  try {
    await db.execAsync("DELETE FROM recipes; DELETE FROM coffee_photos; DELETE FROM brews; DELETE FROM coffees;");
    for (const c of payload.coffees) await createCoffee(db, c);
    for (const b of payload.brews) await createBrew(db, b);
    for (const p of payload.photos ?? []) await createCoffeePhoto(db, p);
    for (const r of payload.recipes ?? []) await upsertRecipe(db, r);
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
