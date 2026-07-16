import { makeTestDb } from "../testdb";
import { createCoffee, listCoffees } from "../coffees";
import { countAllBrews, createBrew, listAllBrews } from "../brews";
import { replaceLedger } from "../importLedger";
import { listAllRecipes } from "../recipes";
import { serializeLedger, parseLedgerFile } from "../../lib/ledgerFile";
import type { Brew, Coffee, Recipe } from "../../models/types";

const coffee = (id: string): Coffee => ({
  id, roaster: "R", name: `N-${id}`, origin: null, process: null,
  roastLevel: null, roastDate: null, notes: null, createdAt: 1,
});

const mkRecipe = (over: Partial<Recipe> = {}): Recipe => ({
  coffeeId: "c1", method: "filter", doseG: 18, waterG: 300,
  grind: null, waterTempC: 93, notes: "x", updatedAt: 2, ...over,
});

const brew = (id: string, coffeeId: string): Brew => ({
  id, coffeeId, brewedAt: 2, method: "filter" as const, doseG: 15, waterG: 250, ratio: 16.7,
  grind: null, waterTempC: null, dripper: null, pours: null, pourIntervalS: null,
  totalTimeS: null, filterType: null, acidity: null,
  sweetness: null, bitterness: null, body: null, clarity: null, rating: null,
  notes: null, createdAt: 2,
});

describe("replaceLedger", () => {
  it("clears the previous ledger and inserts the payload", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee("old"));
    await createBrew(db, brew("old-b", "old"));

    await replaceLedger(db, {
      coffees: [coffee("new1"), coffee("new2")],
      brews: [brew("nb1", "new1")],
      photos: [],
    });

    const coffees = await listCoffees(db);
    expect(coffees.map((c) => c.id).sort()).toEqual(["new1", "new2"]);
    const brews = await listAllBrews(db);
    expect(brews.map((b) => b.id)).toEqual(["nb1"]);
  });

  it("imports an empty ledger (wipes everything)", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee("old"));
    await replaceLedger(db, { coffees: [], brews: [], photos: [] });
    expect(await listCoffees(db)).toEqual([]);
    expect(await countAllBrews(db)).toBe(0);
  });

  it("rolls back completely when an insert fails", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee("keep"));
    await createBrew(db, brew("keep-b", "keep"));

    // Duplicate coffee ids violate the PRIMARY KEY mid-import (validation would
    // normally catch this; the transaction is the backstop).
    await expect(
      replaceLedger(db, { coffees: [coffee("x"), coffee("x")], brews: [], photos: [] })
    ).rejects.toThrow();

    const coffees = await listCoffees(db);
    expect(coffees.map((c) => c.id)).toEqual(["keep"]);
    const brews = await listAllBrews(db);
    expect(brews.map((b) => b.id)).toEqual(["keep-b"]);
  });

  it("replaces photo rows transactionally", async () => {
    const db = await makeTestDb();
    const { listPhotosForCoffee } = await import("../coffeePhotos");
    await replaceLedger(db, {
      coffees: [{ id: "c1", roaster: "Sey", name: "Kenya", origin: null, process: null, roastLevel: null, roastDate: null, notes: null, archived: false, createdAt: 1 }],
      brews: [],
      photos: [{ id: "p1", coffeeId: "c1", uri: "file:///p1.jpg", position: 0, createdAt: 5 }],
    });
    expect((await listPhotosForCoffee(db, "c1")).map((p) => p.id)).toEqual(["p1"]);
    // second import wipes the first
    await replaceLedger(db, {
      coffees: [{ id: "c2", roaster: "Onyx", name: "Geo", origin: null, process: null, roastLevel: null, roastDate: null, notes: null, archived: false, createdAt: 2 }],
      brews: [], photos: [],
    });
    expect(await listPhotosForCoffee(db, "c1")).toEqual([]);
  });

  it("replaceLedger inserts recipes and wipes prior ones", async () => {
    const db = await makeTestDb();
    // seed something to be wiped
    await replaceLedger(db, { coffees: [coffee("c1")], brews: [], recipes: [mkRecipe({ method: "moka" })] });
    // now replace with a different recipe set
    await replaceLedger(db, { coffees: [coffee("c1")], brews: [], recipes: [mkRecipe({ method: "filter" })] });
    const all = await listAllRecipes(db);
    expect(all.map((r) => r.method)).toEqual(["filter"]);
  });

  it("replaceLedger tolerates a payload with no recipes", async () => {
    const db = await makeTestDb();
    await replaceLedger(db, { coffees: [coffee("c1")], brews: [] });
    expect(await listAllRecipes(db)).toEqual([]);
  });
});

// End-to-end proof that recipes survive the full backup path Settings drives:
// serialize → parseLedgerFile → replaceLedger → listAllRecipes.
describe("recipe export → import round-trip", () => {
  it("recipes survive serialize → parse → replaceLedger → listAllRecipes intact", async () => {
    const db = await makeTestDb();
    const coffees = [coffee("c1"), coffee("c2")];
    const recipes = [
      mkRecipe({ coffeeId: "c1", method: "filter", doseG: 18, waterG: 300, grind: "medium", waterTempC: 93, notes: "bloom 45s", updatedAt: 10 }),
      mkRecipe({ coffeeId: "c1", method: "moka", doseG: 16, waterG: 200, grind: null, waterTempC: null, notes: null, updatedAt: 11 }),
      mkRecipe({ coffeeId: "c2", method: "espresso", doseG: 18, waterG: 36, grind: "fine", waterTempC: 92, notes: null, updatedAt: 12 }),
    ];

    const text = serializeLedger(coffees, [], "2026-07-16T00:00:00.000Z", [], recipes);
    const parsed = parseLedgerFile(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Pass recipes straight through (same Recipe[] shape); photos are empty here and
    // take a separate base64→file path in Settings, so they're not part of this payload.
    await replaceLedger(db, {
      coffees: parsed.payload.coffees,
      brews: parsed.payload.brews,
      recipes: parsed.payload.recipes,
    });

    // listAllRecipes orders by (coffee_id, method); match that for a stable compare.
    const expected = [...recipes].sort((a, b) => a.coffeeId.localeCompare(b.coffeeId) || a.method.localeCompare(b.method));
    expect(await listAllRecipes(db)).toEqual(expected);
  });
});
