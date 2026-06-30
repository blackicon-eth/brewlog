import { makeTestDb } from "../testdb";
import { createCoffee } from "../coffees";
import { createBrew, listBrewsForCoffee, getBrew, updateBrew, deleteBrew, avgRating } from "../brews";
import type { Brew, Coffee } from "../../models/types";

const coffee: Coffee = {
  id: "c1", roaster: "Sey", name: "Kenya", origin: null, process: null,
  roastLevel: null, roastDate: null, notes: null, createdAt: 1,
};
const brew = (over: Partial<Brew> = {}): Brew => ({
  id: "b1", coffeeId: "c1", brewedAt: 10, doseG: 15, waterG: 250, ratio: 16.6667,
  grind: "medium-fine", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 30,
  totalTimeS: 165, filterType: "white", tds: 1.4, ey: 21,
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
