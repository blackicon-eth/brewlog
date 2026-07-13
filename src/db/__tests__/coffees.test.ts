import { makeTestDb } from "../testdb";
import { createCoffee, listCoffees, getCoffee, updateCoffee, deleteCoffee } from "../coffees";
import type { Coffee } from "../../models/types";

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
