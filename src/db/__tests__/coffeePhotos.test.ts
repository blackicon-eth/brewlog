import { makeTestDb } from "../testdb";
import { createCoffee } from "../coffees";
import {
  createCoffeePhoto,
  listPhotosForCoffee,
  listAllPhotos,
  deleteCoffeePhoto,
  updateCoffeePhotoPosition,
} from "../coffeePhotos";
import type { Coffee, CoffeePhoto } from "../../models/types";

const coffee = (id = "c1"): Coffee => ({
  id, roaster: "Sey", name: "Kenya", origin: null, process: null,
  roastLevel: null, roastDate: null, notes: null, archived: false, createdAt: 1,
});
const photo = (over: Partial<CoffeePhoto> = {}): CoffeePhoto => ({
  id: "p1", coffeeId: "c1", uri: "file:///photos/p1.jpg", position: 0, createdAt: 10, ...over,
});

it("creates and lists photos for a coffee ordered by position", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await createCoffeePhoto(db, photo({ id: "b", position: 1, uri: "file:///b.jpg" }));
  await createCoffeePhoto(db, photo({ id: "a", position: 0, uri: "file:///a.jpg" }));
  const list = await listPhotosForCoffee(db, "c1");
  expect(list.map((p) => p.id)).toEqual(["a", "b"]);
  expect(list[0]).toEqual(photo({ id: "a", position: 0, uri: "file:///a.jpg" }));
});

it("deletes a single photo", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await createCoffeePhoto(db, photo({ id: "p1" }));
  await deleteCoffeePhoto(db, "p1");
  expect(await listPhotosForCoffee(db, "c1")).toEqual([]);
});

it("cascade-deletes photos when the coffee is deleted", async () => {
  const db = await makeTestDb();
  const { deleteCoffee } = await import("../coffees");
  await createCoffee(db, coffee());
  await createCoffeePhoto(db, photo({ id: "p1" }));
  await createCoffeePhoto(db, photo({ id: "p2", position: 1 }));
  await deleteCoffee(db, "c1");
  expect(await listPhotosForCoffee(db, "c1")).toEqual([]);
});

it("lists all photos across coffees for export", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee("c1"));
  await createCoffee(db, coffee("c2"));
  await createCoffeePhoto(db, photo({ id: "p1", coffeeId: "c1", position: 0 }));
  await createCoffeePhoto(db, photo({ id: "p2", coffeeId: "c2", position: 0 }));
  expect((await listAllPhotos(db)).map((p) => p.id).sort()).toEqual(["p1", "p2"]);
});

it("updates a photo's position and reorders the list", async () => {
  const db = await makeTestDb();
  await createCoffee(db, coffee());
  await createCoffeePhoto(db, photo({ id: "a", position: 0 }));
  await createCoffeePhoto(db, photo({ id: "b", position: 1 }));
  await updateCoffeePhotoPosition(db, "a", 2);
  const list = await listPhotosForCoffee(db, "c1");
  expect(list.map((p) => p.id)).toEqual(["b", "a"]);
});
