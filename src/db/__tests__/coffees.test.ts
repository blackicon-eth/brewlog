import { makeTestDb } from "../testdb";
import { createCoffee, listCoffees, getCoffee, updateCoffee, deleteCoffee, listCoffeesWithStats } from "../coffees";
import { createBrew } from "../brews";
import type { Coffee, Brew } from "../../models/types";

const coffee = (over: Partial<Coffee> = {}): Coffee => ({
  id: "c1", roaster: "Sey", name: "Kenya AA", origin: "Kenya", process: "washed",
  roastLevel: "light", roastDate: "2026-06-10", notes: "blackcurrant", archived: false, createdAt: 100, ...over,
});

it("creates and reads a coffee", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  const got = await getCoffee(db, "c1");
  expect(got).toEqual(coffee());
});

it("lists newest first", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee({ id: "a", createdAt: 1 }));
  await createCoffee(db, coffee({ id: "b", createdAt: 2 }));
  const list = await listCoffees(db);
  expect(list.map((c) => c.id)).toEqual(["b", "a"]);
});

it("updates a coffee", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await updateCoffee(db, coffee({ name: "Kenya Nyeri", notes: null }));
  const got = await getCoffee(db, "c1");
  expect(got?.name).toBe("Kenya Nyeri");
  expect(got?.notes).toBeNull();
});

it("deletes a coffee", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await deleteCoffee(db, "c1");
  expect(await getCoffee(db, "c1")).toBeNull();
});

describe("listCoffeesWithStats", () => {
  const brew = (over: Partial<Brew> = {}): Brew => ({
    id: "b1", coffeeId: "c1", brewedAt: 10, method: "filter", doseG: 15, waterG: 250, ratio: 16.6667,
    grind: "medium-fine", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 30,
    totalTimeS: 165, filterType: "white", preheat: null, heat: null,
    acidity: 4, sweetness: 3, bitterness: 2, body: 3, clarity: 4, rating: 4,
    notes: "fruity", createdAt: 10, ...over,
  });

  it("aggregates count and average rating per coffee in one pass", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee({ id: "c1", createdAt: 2 }));
    await createCoffee(db, coffee({ id: "c2", createdAt: 1 }));
    await createBrew(db, brew({ id: "a", coffeeId: "c1", rating: 4 }));
    await createBrew(db, brew({ id: "b", coffeeId: "c1", rating: 2 }));
    await createBrew(db, brew({ id: "c", coffeeId: "c2", rating: 5 }));
    const rows = await listCoffeesWithStats(db);
    // newest createdAt first, matching listCoffees
    expect(rows.map((r) => r.id)).toEqual(["c1", "c2"]);
    expect(rows[0]).toMatchObject({ id: "c1", brewCount: 2, avg: 3 });
    expect(rows[1]).toMatchObject({ id: "c2", brewCount: 1, avg: 5 });
  });

  it("reports zero brews and null average for a brew-less coffee", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee({ id: "c1" }));
    const rows = await listCoffeesWithStats(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "c1", brewCount: 0, avg: null });
  });

  it("ignores null ratings in the average but still counts the brew", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee({ id: "c1" }));
    await createBrew(db, brew({ id: "a", coffeeId: "c1", rating: 4 }));
    await createBrew(db, brew({ id: "b", coffeeId: "c1", rating: null }));
    const rows = await listCoffeesWithStats(db);
    expect(rows[0]).toMatchObject({ id: "c1", brewCount: 2, avg: 4 });
  });

  it("counts brews but reports a null average when every rating is null", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee({ id: "c1" }));
    await createBrew(db, brew({ id: "a", coffeeId: "c1", rating: null }));
    await createBrew(db, brew({ id: "b", coffeeId: "c1", rating: null }));
    const rows = await listCoffeesWithStats(db);
    // AVG over all-NULL ratings is NULL — matching avgRating()'s null-when-none contract.
    expect(rows[0]).toMatchObject({ id: "c1", brewCount: 2, avg: null });
  });

  it("returns a fractional average unrounded", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee({ id: "c1" }));
    await createBrew(db, brew({ id: "a", coffeeId: "c1", rating: 4 }));
    await createBrew(db, brew({ id: "b", coffeeId: "c1", rating: 2 }));
    await createBrew(db, brew({ id: "c", coffeeId: "c1", rating: 5 }));
    const rows = await listCoffeesWithStats(db);
    // (4 + 2 + 5) / 3 = 3.6666… — the query must not round; CoffeeCard formats for display.
    expect(rows[0].brewCount).toBe(3);
    expect(rows[0].avg).toBeCloseTo(11 / 3, 10);
  });

  it("keeps each coffee's stats to its own brews", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee({ id: "c1", createdAt: 2 }));
    await createCoffee(db, coffee({ id: "c2", createdAt: 1 }));
    await createBrew(db, brew({ id: "a", coffeeId: "c1", rating: 5 }));
    const rows = await listCoffeesWithStats(db);
    const c1 = rows.find((r) => r.id === "c1")!;
    const c2 = rows.find((r) => r.id === "c2")!;
    expect(c1).toMatchObject({ brewCount: 1, avg: 5 });
    expect(c2).toMatchObject({ brewCount: 0, avg: null });
  });

  it("returns a full Coffee shape alongside the stats", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee({ id: "c1", roaster: "Sey", name: "Kenya AA" }));
    const rows = await listCoffeesWithStats(db);
    expect(rows[0]).toMatchObject({ id: "c1", roaster: "Sey", name: "Kenya AA", brewCount: 0, avg: null });
  });
});
