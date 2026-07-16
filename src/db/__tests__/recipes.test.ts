import { makeTestDb } from "../testdb";
import { createCoffee, deleteCoffee } from "../coffees";
import { upsertRecipe, getRecipe, listRecipes, listAllRecipes, deleteRecipe } from "../recipes";
import type { Coffee, Recipe } from "../../models/types";

const coffee = (id = "c1"): Coffee => ({
  id, roaster: "Sey", name: "Kenya", origin: null, process: null,
  roastLevel: null, roastDate: null, notes: null, archived: false, createdAt: 1,
});

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  coffeeId: "c1", method: "filter", doseG: 18, waterG: 300,
  grind: "medium-fine", waterTempC: 94, notes: "bloom 45s", updatedAt: 10, ...over,
});

it("inserts a recipe and reads it back by coffee + method", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await upsertRecipe(db, recipe());
  expect(await getRecipe(db, "c1", "filter")).toEqual(recipe());
  expect(await getRecipe(db, "c1", "moka")).toBeNull();
});

it("upsert updates the same (coffee, method) row instead of duplicating", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await upsertRecipe(db, recipe({ doseG: 18, notes: "v1" }));
  await upsertRecipe(db, recipe({ doseG: 20, waterG: 320, grind: "coarser", waterTempC: 96, notes: "v2", updatedAt: 20 }));
  const list = await listRecipes(db, "c1");
  expect(list).toHaveLength(1);
  expect(list[0]).toEqual(recipe({ doseG: 20, waterG: 320, grind: "coarser", waterTempC: 96, notes: "v2", updatedAt: 20 }));
});

it("keeps one recipe per method for a coffee", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await upsertRecipe(db, recipe({ method: "filter" }));
  await upsertRecipe(db, recipe({ method: "moka", waterTempC: null }));
  expect((await listRecipes(db, "c1")).map((r) => r.method).sort()).toEqual(["filter", "moka"]);
});

it("stores null optional fields round-trip", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  const bare = recipe({ doseG: null, waterG: null, grind: null, waterTempC: null, notes: "just notes" });
  await upsertRecipe(db, bare);
  expect(await getRecipe(db, "c1", "filter")).toEqual(bare);
});

it("deletes a single recipe", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await upsertRecipe(db, recipe());
  await deleteRecipe(db, "c1", "filter");
  expect(await getRecipe(db, "c1", "filter")).toBeNull();
});

it("cascade-deletes recipes when the coffee is deleted", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await upsertRecipe(db, recipe());
  await deleteCoffee(db, "c1");
  expect(await listAllRecipes(db)).toEqual([]);
});

it("normalizes a legacy 'v60' method to 'filter' on read", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await db.runAsync(
    "INSERT INTO recipes (coffee_id, method, dose_g, water_g, grind, water_temp_c, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["c1", "v60", 15, 250, null, 92, null, 5]
  );
  const r = await getRecipe(db, "c1", "filter");
  expect(r?.method).toBe("filter");
});
