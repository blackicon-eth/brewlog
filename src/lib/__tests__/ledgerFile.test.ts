import {
  LEDGER_FORMAT,
  LEDGER_VERSION,
  ledgerFilename,
  parseLedgerFile,
  serializeLedger,
} from "../ledgerFile";
import type { Brew, Coffee } from "../../models/types";

const coffee = (over: Partial<Coffee> = {}): Coffee => ({
  id: "c1", roaster: "La Cabra", name: "Aricha", origin: "Ethiopia", process: "Washed",
  roastLevel: "Light", roastDate: "2026-06-01", notes: null, createdAt: 1720000000000,
  ...over,
});

const brew = (over: Partial<Brew> = {}): Brew => ({
  id: "b1", coffeeId: "c1", brewedAt: 1720000001000, method: "filter" as const, doseG: 15, waterG: 250, ratio: 16.7,
  grind: "20 clicks", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 45,
  totalTimeS: 180, filterType: "paper", preheat: null, heat: null, acidity: 4, sweetness: 4,
  bitterness: 2, body: 3, clarity: 4, rating: 8, notes: null, createdAt: 1720000001000,
  ...over,
});

const validFile = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: LEDGER_FORMAT,
    version: LEDGER_VERSION,
    exportedAt: "2026-07-09T12:00:00.000Z",
    coffees: [coffee()],
    brews: [brew()],
    ...over,
  });

describe("serializeLedger", () => {
  it("round-trips through parseLedgerFile", () => {
    const text = serializeLedger([coffee()], [brew()], "2026-07-09T12:00:00.000Z");
    const res = parseLedgerFile(text);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.coffees).toEqual([coffee()]);
      expect(res.payload.brews).toEqual([brew()]);
    }
  });

  it("writes the exact envelope", () => {
    const parsed = JSON.parse(serializeLedger([], [], "2026-07-09T12:00:00.000Z"));
    expect(parsed).toEqual({
      format: "brewlog-ledger",
      version: 2,
      exportedAt: "2026-07-09T12:00:00.000Z",
      coffees: [],
      brews: [],
    });
  });

  it("strips unknown fields and normalizes missing optionals to null", () => {
    const joined = { ...brew(), roaster: "La Cabra", coffeeName: "Aricha" } as Brew;
    const bare = { id: "c2", roaster: "Tim W", name: "Kenya", createdAt: 1 } as Coffee;
    const text = serializeLedger([bare], [joined], "2026-07-09T12:00:00.000Z");
    const parsed = JSON.parse(text);
    expect(parsed.brews[0].roaster).toBeUndefined();
    expect(parsed.brews[0].coffeeName).toBeUndefined();
    expect(parsed.coffees[0].origin).toBeNull();
    expect(parsed.coffees[0].notes).toBeNull();
  });
});

describe("parseLedgerFile rejections", () => {
  it("rejects non-JSON", () => {
    const res = parseLedgerFile("not json {");
    expect(res).toEqual({ ok: false, reason: "This file isn't readable as JSON." });
  });

  it("rejects JSON that isn't an object", () => {
    expect(parseLedgerFile("[1,2]").ok).toBe(false);
    expect(parseLedgerFile("42").ok).toBe(false);
  });

  it("rejects a wrong or missing format marker", () => {
    const res = parseLedgerFile(validFile({ format: "someone-elses" }));
    expect(res).toEqual({ ok: false, reason: "This doesn't look like a Brewlog ledger file." });
  });

  it("rejects a version newer than the app understands", () => {
    const res = parseLedgerFile(validFile({ version: 3 }));
    expect(res).toEqual({
      ok: false,
      reason: "This ledger was made by a newer version of Brewlog. Update the app to import it.",
    });
  });

  it("rejects a missing or non-numeric version", () => {
    expect(parseLedgerFile(validFile({ version: "1" })).ok).toBe(false);
    expect(parseLedgerFile(validFile({ version: undefined })).ok).toBe(false);
  });

  it("rejects non-array coffees/brews", () => {
    expect(parseLedgerFile(validFile({ coffees: {} })).ok).toBe(false);
    expect(parseLedgerFile(validFile({ brews: null })).ok).toBe(false);
  });

  it("rejects a coffee missing a required field, naming the record", () => {
    const res = parseLedgerFile(validFile({ coffees: [{ ...coffee(), name: "" }] }));
    expect(res).toEqual({ ok: false, reason: "Coffee 1 is missing a valid name." });
  });

  it("rejects a coffee with a wrongly typed optional", () => {
    expect(parseLedgerFile(validFile({ coffees: [{ ...coffee(), origin: 7 }] })).ok).toBe(false);
  });

  it("rejects a brew with a non-finite number", () => {
    const res = parseLedgerFile(
      validFile({ brews: [{ ...brew(), doseG: null }] })
    );
    expect(res).toEqual({ ok: false, reason: "Brew 1 is missing a valid doseG." });
  });

  it("rejects duplicate ids", () => {
    expect(parseLedgerFile(validFile({ coffees: [coffee(), coffee()] }))).toEqual({
      ok: false,
      reason: "Coffee 2 repeats the id of an earlier coffee.",
    });
    expect(parseLedgerFile(validFile({ brews: [brew(), brew()] }))).toEqual({
      ok: false,
      reason: "Brew 2 repeats the id of an earlier brew.",
    });
  });

  it("rejects a brew pointing at a coffee not in the file", () => {
    const res = parseLedgerFile(validFile({ brews: [brew({ coffeeId: "ghost" })] }));
    expect(res).toEqual({
      ok: false,
      reason: "Brew 1 belongs to a coffee that isn't in the file.",
    });
  });

  it("accepts optionals that are absent, null, or valid", () => {
    const sparse = { id: "c9", roaster: "R", name: "N", createdAt: 5 };
    const sparseBrew = {
      id: "b9", coffeeId: "c9", brewedAt: 1, method: "filter", doseG: 15, waterG: 250, ratio: 16.7, createdAt: 1,
    };
    const res = parseLedgerFile(validFile({ coffees: [sparse], brews: [sparseBrew] }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.coffees[0].origin).toBeNull();
      expect(res.payload.brews[0].rating).toBeNull();
    }
  });
});

describe("ledger v2 (methods)", () => {
  it("round-trips a moka and an espresso brew", () => {
    const moka = brew({
      id: "b1", method: "moka" as const, preheat: true, heat: "medium" as const,
    });
    const espresso = brew({ id: "b2", method: "espresso" as const, preheat: null, heat: null });
    const text = serializeLedger([coffee()], [moka, espresso], "2026-07-09T12:00:00.000Z");
    const res = parseLedgerFile(text);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.brews[0].method).toBe("moka");
      expect(res.payload.brews[0].preheat).toBe(true);
      expect(res.payload.brews[0].heat).toBe("medium");
      expect(res.payload.brews[1].method).toBe("espresso");
    }
  });

  it("accepts a version-1 file and defaults its brews to filter", () => {
    const parsed = JSON.parse(
      serializeLedger([coffee()], [brew({ method: "moka" as const, preheat: true, heat: "high" as const })], "2026-07-09T12:00:00.000Z")
    );
    parsed.version = 1;
    for (const b of parsed.brews) {
      delete b.method;
      delete b.preheat;
      delete b.heat;
    }
    const res = parseLedgerFile(JSON.stringify(parsed));
    expect(res.ok).toBe(true);
    if (res.ok) {
      for (const b of res.payload.brews) {
        expect(b.method).toBe("filter");
        expect(b.preheat).toBeNull();
        expect(b.heat).toBeNull();
      }
    }
  });

  it("accepts the pre-rename v60 id in a v2 file and normalizes it to filter", () => {
    const parsed = JSON.parse(
      serializeLedger([coffee()], [brew()], "2026-07-09T12:00:00.000Z")
    );
    for (const b of parsed.brews) b.method = "v60";
    const res = parseLedgerFile(JSON.stringify(parsed));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.brews[0].method).toBe("filter");
  });

  it("rejects version 3 as newer", () => {
    const res = parseLedgerFile(validFile({ version: 3 }));
    expect(res).toEqual({
      ok: false,
      reason: "This ledger was made by a newer version of Brewlog. Update the app to import it.",
    });
  });

  it("rejects an invalid method in a v2 file", () => {
    const res = parseLedgerFile(validFile({ brews: [{ ...brew(), method: "aeropress" }] }));
    expect(res).toEqual({ ok: false, reason: "Brew 1 has an invalid method." });
  });

  it("rejects a missing method in a v2 file", () => {
    const missing = { ...brew() } as Record<string, unknown>;
    delete missing.method;
    const res = parseLedgerFile(validFile({ brews: [missing] }));
    expect(res).toEqual({ ok: false, reason: "Brew 1 has an invalid method." });
  });

  it("rejects an invalid preheat and an invalid heat", () => {
    const badPreheat = parseLedgerFile(validFile({ brews: [{ ...brew(), preheat: "yes" }] }));
    expect(badPreheat).toEqual({ ok: false, reason: "Brew 1 has an invalid preheat." });

    const badHeat = parseLedgerFile(validFile({ brews: [{ ...brew(), heat: "max" }] }));
    expect(badHeat).toEqual({ ok: false, reason: "Brew 1 has an invalid heat." });
  });
});

describe("ledgerFilename", () => {
  it("formats the local date with padding", () => {
    expect(ledgerFilename(new Date(2026, 6, 9))).toBe("brewlog-ledger-2026-07-09.json");
    expect(ledgerFilename(new Date(2026, 10, 23))).toBe("brewlog-ledger-2026-11-23.json");
  });
});
