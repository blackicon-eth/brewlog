import { makeTestDb } from "../testdb";

describe("schema", () => {
  it("creates coffees and brews tables", async () => {
    const db = await makeTestDb();
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain("coffees");
    expect(names).toContain("brews");
  });

  it("enforces ON DELETE CASCADE from coffees to brews", async () => {
    const db = await makeTestDb();
    await db.runAsync(
      "INSERT INTO coffees (id, roaster, name, created_at) VALUES (?, ?, ?, ?)",
      ["c1", "Roaster", "Bean", 1]
    );
    await db.runAsync(
      "INSERT INTO brews (id, coffee_id, brewed_at, dose_g, water_g, ratio, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["b1", "c1", 1, 15, 250, 16.7, 1]
    );
    await db.runAsync("DELETE FROM coffees WHERE id = ?", ["c1"]);
    const brews = await db.getAllAsync("SELECT * FROM brews");
    expect(brews).toHaveLength(0);
  });
});
