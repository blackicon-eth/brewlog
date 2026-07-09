import { makeTestDb } from "../testdb";
import { createCoffee } from "../coffees";
import { createBrew, listBrewsForCoffee, listAllBrews, getBrew, updateBrew, deleteBrew, avgRating } from "../brews";
import type { Brew, Coffee } from "../../models/types";

const coffee: Coffee = {
  id: "c1", roaster: "Sey", name: "Kenya", origin: null, process: null,
  roastLevel: null, roastDate: null, notes: null, createdAt: 1,
};
const brew = (over: Partial<Brew> = {}): Brew => ({
  id: "b1", coffeeId: "c1", brewedAt: 10, method: "v60" as const, doseG: 15, waterG: 250, ratio: 16.6667,
  grind: "medium-fine", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 30,
  totalTimeS: 165, filterType: "white", preheat: null, heat: null, tds: 1.4, ey: 21,
  acidity: 4, sweetness: 3, bitterness: 2, body: 3, clarity: 4, rating: 4,
  notes: "fruity", createdAt: 10, ...over,
});

it("round-trips a fully populated brew", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee);
  await createBrew(db, brew());
  expect(await getBrew(db, "b1")).toEqual(brew());
});

it("lists brews for a coffee newest first", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee);
  await createBrew(db, brew({ id: "x", brewedAt: 5 }));
  await createBrew(db, brew({ id: "y", brewedAt: 9 }));
  const list = await listBrewsForCoffee(db, "c1");
  expect(list.map((b) => b.id)).toEqual(["y", "x"]);
});

it("updates and deletes a brew", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee);
  await createBrew(db, brew());
  await updateBrew(db, brew({ rating: 5, notes: null }));
  expect((await getBrew(db, "b1"))?.rating).toBe(5);
  await deleteBrew(db, "b1");
  expect(await getBrew(db, "b1")).toBeNull();
});

it("lists brews across all coffees newest first, tagged with coffee identity", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee);
  await createCoffee(db, { ...coffee, id: "c2", roaster: "Onyx", name: "Geometry" });
  await createBrew(db, brew({ id: "a", coffeeId: "c1", brewedAt: 5 }));
  await createBrew(db, brew({ id: "b", coffeeId: "c2", brewedAt: 9 }));
  const all = await listAllBrews(db);
  expect(all.map((x) => x.id)).toEqual(["b", "a"]);
  expect(all[0]).toMatchObject({ coffeeId: "c2", roaster: "Onyx", coffeeName: "Geometry" });
  expect(all[1]).toMatchObject({ coffeeId: "c1", roaster: "Sey", coffeeName: "Kenya" });
});

it("pages through all brews with limit/offset without gaps or repeats", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee);
  // Five brews, distinct times so the newest-first order is unambiguous.
  for (let i = 0; i < 5; i++) await createBrew(db, brew({ id: `b${i}`, brewedAt: i }));

  const page1 = await listAllBrews(db, { limit: 2, offset: 0 });
  const page2 = await listAllBrews(db, { limit: 2, offset: 2 });
  const page3 = await listAllBrews(db, { limit: 2, offset: 4 });
  expect(page1.map((b) => b.id)).toEqual(["b4", "b3"]);
  expect(page2.map((b) => b.id)).toEqual(["b2", "b1"]);
  expect(page3.map((b) => b.id)).toEqual(["b0"]); // short final page => end reached
});

it("keeps a stable total order when brews share a brewed_at", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee);
  await createBrew(db, brew({ id: "a", brewedAt: 10 }));
  await createBrew(db, brew({ id: "c", brewedAt: 10 }));
  await createBrew(db, brew({ id: "b", brewedAt: 10 }));
  // Same instant → id DESC breaks the tie, so paging across the boundary is deterministic.
  const first = await listAllBrews(db, { limit: 2, offset: 0 });
  const second = await listAllBrews(db, { limit: 2, offset: 2 });
  expect([...first, ...second].map((b) => b.id)).toEqual(["c", "b", "a"]);
});

describe("avgRating", () => {
  it("averages defined ratings", () => {
    expect(avgRating([brew({ rating: 4 }), brew({ rating: 2 })])).toBe(3);
  });
  it("ignores null ratings", () => {
    expect(avgRating([brew({ rating: 4 }), brew({ rating: null })])).toBe(4);
  });
  it("returns null with no ratings", () => {
    expect(avgRating([brew({ rating: null })])).toBeNull();
  });
});
