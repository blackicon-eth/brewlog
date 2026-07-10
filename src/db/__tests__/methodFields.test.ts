import { makeTestDb } from "../testdb";
import { createCoffee } from "../coffees";
import { createBrew, getBrew, updateBrew, getLatestBrew } from "../brews";
import type { Brew, Coffee } from "../../models/types";

const coffee: Coffee = { id: "c1", roaster: "Sey", name: "Kieni", createdAt: 1 };
const base: Brew = {
  id: "b1", coffeeId: "c1", brewedAt: 1000, method: "moka",
  doseG: 16, waterG: 200, ratio: 12.5, preheat: true, heat: "medium", createdAt: 1000,
};

describe("method fields in the data layer", () => {
  it("round-trips method, preheat, and heat", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee);
    await createBrew(db, base);
    const back = await getBrew(db, "b1");
    expect(back?.method).toBe("moka");
    expect(back?.preheat).toBe(true);
    expect(back?.heat).toBe("medium");
  });

  it("round-trips preheat=false distinctly from null", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee);
    await createBrew(db, { ...base, id: "b2", preheat: false, heat: null });
    const back = await getBrew(db, "b2");
    expect(back?.preheat).toBe(false);
    expect(back?.heat).toBeNull();
  });

  it("updateBrew persists a method switch and clears moka fields", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee);
    await createBrew(db, base);
    await updateBrew(db, { ...base, method: "espresso", preheat: null, heat: null, waterG: 36, ratio: 2.25 });
    const back = await getBrew(db, "b1");
    expect(back?.method).toBe("espresso");
    expect(back?.preheat).toBeNull();
    expect(back?.heat).toBeNull();
  });

  it("getLatestBrew returns the newest brew, or null when none", async () => {
    const db = await makeTestDb();
    await createCoffee(db, coffee);
    expect(await getLatestBrew(db, "c1")).toBeNull();
    await createBrew(db, { ...base, id: "old", brewedAt: 500, method: "filter" });
    await createBrew(db, { ...base, id: "new", brewedAt: 2000, method: "espresso" });
    expect((await getLatestBrew(db, "c1"))?.method).toBe("espresso");
  });
});
