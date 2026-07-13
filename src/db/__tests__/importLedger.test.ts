import { makeTestDb } from "../testdb";
import { createCoffee, listCoffees } from "../coffees";
import { countAllBrews, createBrew, listAllBrews } from "../brews";
import { replaceLedger } from "../importLedger";
import type { Brew, Coffee } from "../../models/types";

const coffee = (id: string): Coffee => ({
  id, roaster: "R", name: `N-${id}`, origin: null, process: null,
  roastLevel: null, roastDate: null, notes: null, createdAt: 1,
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
    });

    const coffees = await listCoffees(db);
    expect(coffees.map((c) => c.id).sort()).toEqual(["new1", "new2"]);
    const brews = await listAllBrews(db);
    expect(brews.map((b) => b.id)).toEqual(["nb1"]);
  });

  it("imports an empty ledger (wipes everything)", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee("old"));
    await replaceLedger(db, { coffees: [], brews: [] });
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
      replaceLedger(db, { coffees: [coffee("x"), coffee("x")], brews: [] })
    ).rejects.toThrow();

    const coffees = await listCoffees(db);
    expect(coffees.map((c) => c.id)).toEqual(["keep"]);
    const brews = await listAllBrews(db);
    expect(brews.map((b) => b.id)).toEqual(["keep-b"]);
  });
});
