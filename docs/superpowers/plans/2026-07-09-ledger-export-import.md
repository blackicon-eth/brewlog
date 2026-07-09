# Ledger Export / Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Settings "Your data" card to real files — export coffees + brews to a versioned JSON file anywhere on the phone, import one back with strict validation and a destructive-overwrite confirmation — plus tighten the export icon.

**Architecture:** A pure format module (`src/lib/ledgerFile.ts`, no Expo imports, Jest-covered) owns serialization and strict validation. A small DB module (`src/db/importLedger.ts`) replaces both tables inside one SQLite transaction. `SettingsScreen` glues them to the SAF-backed pickers that ship inside the already-installed `expo-file-system` 19 (`Directory.pickDirectoryAsync`, `File.pickFileAsync`).

**Tech Stack:** Expo SDK 54, expo-file-system ~19.0.23 (new `File`/`Directory` API), expo-sqlite via the app's `Db` interface, Jest + ts-jest + better-sqlite3 test harness.

## Global Constraints

- **Zero new dependencies, zero native risk** — only `expo-file-system` ~19.0.23 already in package.json. Do NOT add expo-document-picker, expo-sharing, or any other package.
- Pure logic in `src/lib` must have **no Expo/React imports** (Jest runs in plain Node, same pattern as `src/lib/aiModels.ts`).
- File format envelope exactly: `{ "format": "brewlog-ledger", "version": 1, "exportedAt": <ISO string>, "coffees": [...], "brews": [...] }`.
- Import validation is **strict, all-or-nothing**: one bad record rejects the whole file with a human-readable reason.
- Import replaces the ledger inside **one transaction**; any failure rolls back completely.
- Filename: `brewlog-ledger-YYYY-MM-DD.json` (local date).
- Confirm modal before overwrite uses the existing AppModal `confirm` with `destructive: true` (renders the dangerSolid button).
- Copy voice: plain, calm ledger language ("ledger", never "database"); the AI is never mentioned here.
- Per AGENTS.md: before writing the Expo-facing code in Task 3, verify `Directory.pickDirectoryAsync` / `File.pickFileAsync` / `directory.createFile` / `file.write` / `file.text` against https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/ (the signatures below were confirmed against the installed package's `.d.ts`).
- Gates before every commit: `npx tsc --noEmit` clean and `npx jest` fully green.

---

### Task 1: Ledger file format — serialize + validate (`src/lib/ledgerFile.ts`)

**Files:**
- Create: `src/lib/ledgerFile.ts`
- Test: `src/lib/__tests__/ledgerFile.test.ts`

**Interfaces:**
- Consumes: `Coffee`, `Brew` types from `src/models/types.ts` (type-only imports — allowed, they're plain types).
- Produces (Tasks 2 and 3 rely on these exact names):
  - `LEDGER_FORMAT = "brewlog-ledger"`, `LEDGER_VERSION = 1`
  - `type LedgerPayload = { coffees: Coffee[]; brews: Brew[] }`
  - `serializeLedger(coffees: Coffee[], brews: Brew[], exportedAt: string): string`
  - `parseLedgerFile(text: string): { ok: true; payload: LedgerPayload } | { ok: false; reason: string }`
  - `ledgerFilename(date: Date): string`

Serialization whitelists fields explicitly so join extras (e.g. `BrewWithCoffee`'s `roaster`/`coffeeName`) can never leak into the file, and normalizes missing optionals to `null`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/ledgerFile.test.ts`:

```ts
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
  id: "b1", coffeeId: "c1", brewedAt: 1720000001000, doseG: 15, waterG: 250, ratio: 16.7,
  grind: "20 clicks", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 45,
  totalTimeS: 180, filterType: "paper", tds: null, ey: null, acidity: 4, sweetness: 4,
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
      version: 1,
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
    const res = parseLedgerFile(validFile({ version: 2 }));
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
      id: "b9", coffeeId: "c9", brewedAt: 1, doseG: 15, waterG: 250, ratio: 16.7, createdAt: 1,
    };
    const res = parseLedgerFile(validFile({ coffees: [sparse], brews: [sparseBrew] }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.coffees[0].origin).toBeNull();
      expect(res.payload.brews[0].rating).toBeNull();
    }
  });
});

describe("ledgerFilename", () => {
  it("formats the local date with padding", () => {
    expect(ledgerFilename(new Date(2026, 6, 9))).toBe("brewlog-ledger-2026-07-09.json");
    expect(ledgerFilename(new Date(2026, 10, 23))).toBe("brewlog-ledger-2026-11-23.json");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/__tests__/ledgerFile.test.ts`
Expected: FAIL — cannot find module `../ledgerFile`.

- [ ] **Step 3: Implement `src/lib/ledgerFile.ts`**

```ts
import type { Brew, Coffee } from "../models/types";

// The standardized ledger file: a versioned JSON envelope around the camel-case
// domain models. Pure module — no Expo imports — so Jest covers every branch.
export const LEDGER_FORMAT = "brewlog-ledger";
export const LEDGER_VERSION = 1;

export type LedgerPayload = { coffees: Coffee[]; brews: Brew[] };
export type LedgerParseResult =
  | { ok: true; payload: LedgerPayload }
  | { ok: false; reason: string };

// Field lists drive both serialization (whitelist — join extras like BrewWithCoffee's
// roaster/coffeeName can never leak into the file) and validation.
const COFFEE_OPTIONAL_STRINGS = ["origin", "process", "roastLevel", "roastDate", "notes"] as const;
const BREW_REQUIRED_NUMBERS = ["brewedAt", "doseG", "waterG", "ratio", "createdAt"] as const;
const BREW_OPTIONAL_NUMBERS = [
  "waterTempC", "pours", "pourIntervalS", "totalTimeS", "tds", "ey",
  "acidity", "sweetness", "bitterness", "body", "clarity", "rating",
] as const;
const BREW_OPTIONAL_STRINGS = ["grind", "dripper", "filterType", "notes"] as const;

function coffeeOut(c: Coffee): Coffee {
  return {
    id: c.id, roaster: c.roaster, name: c.name,
    origin: c.origin ?? null, process: c.process ?? null, roastLevel: c.roastLevel ?? null,
    roastDate: c.roastDate ?? null, notes: c.notes ?? null, createdAt: c.createdAt,
  };
}

function brewOut(b: Brew): Brew {
  return {
    id: b.id, coffeeId: b.coffeeId, brewedAt: b.brewedAt,
    doseG: b.doseG, waterG: b.waterG, ratio: b.ratio,
    grind: b.grind ?? null, waterTempC: b.waterTempC ?? null, dripper: b.dripper ?? null,
    pours: b.pours ?? null, pourIntervalS: b.pourIntervalS ?? null,
    totalTimeS: b.totalTimeS ?? null, filterType: b.filterType ?? null,
    tds: b.tds ?? null, ey: b.ey ?? null,
    acidity: b.acidity ?? null, sweetness: b.sweetness ?? null, bitterness: b.bitterness ?? null,
    body: b.body ?? null, clarity: b.clarity ?? null, rating: b.rating ?? null,
    notes: b.notes ?? null, createdAt: b.createdAt,
  };
}

export function serializeLedger(coffees: Coffee[], brews: Brew[], exportedAt: string): string {
  return JSON.stringify(
    {
      format: LEDGER_FORMAT,
      version: LEDGER_VERSION,
      exportedAt,
      coffees: coffees.map(coffeeOut),
      brews: brews.map(brewOut),
    },
    null,
    2
  );
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const finiteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
// Optionals may be absent or null; when present they must be the right primitive.
const optionalOk = (v: unknown, type: "string" | "number") =>
  v === undefined || v === null || (type === "number" ? finiteNumber(v) : typeof v === "string");

// Strict, all-or-nothing validation. One bad record rejects the whole file — a
// replace-import must be atomic, so a half-valid file is a "no" with a reason.
export function parseLedgerFile(text: string): LedgerParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "This file isn't readable as JSON." };
  }
  if (!isRec(raw)) return { ok: false, reason: "This file isn't readable as JSON." };
  if (raw.format !== LEDGER_FORMAT) {
    return { ok: false, reason: "This doesn't look like a Brewlog ledger file." };
  }
  if (!finiteNumber(raw.version)) {
    return { ok: false, reason: "This ledger file has no readable version." };
  }
  if (raw.version > LEDGER_VERSION) {
    return {
      ok: false,
      reason: "This ledger was made by a newer version of Brewlog. Update the app to import it.",
    };
  }
  if (!Array.isArray(raw.coffees)) return { ok: false, reason: "The file has no list of coffees." };
  if (!Array.isArray(raw.brews)) return { ok: false, reason: "The file has no list of brews." };

  const coffees: Coffee[] = [];
  const coffeeIds = new Set<string>();
  for (let i = 0; i < raw.coffees.length; i++) {
    const c = raw.coffees[i];
    const label = `Coffee ${i + 1}`;
    if (!isRec(c)) return { ok: false, reason: `${label} isn't a record.` };
    for (const field of ["id", "roaster", "name"] as const) {
      if (!nonEmptyString(c[field])) return { ok: false, reason: `${label} is missing a valid ${field}.` };
    }
    if (!finiteNumber(c.createdAt)) return { ok: false, reason: `${label} is missing a valid createdAt.` };
    for (const field of COFFEE_OPTIONAL_STRINGS) {
      if (!optionalOk(c[field], "string")) return { ok: false, reason: `${label} has an invalid ${field}.` };
    }
    if (coffeeIds.has(c.id as string)) {
      return { ok: false, reason: `${label} repeats the id of an earlier coffee.` };
    }
    coffeeIds.add(c.id as string);
    coffees.push(coffeeOut(c as unknown as Coffee));
  }

  const brews: Brew[] = [];
  const brewIds = new Set<string>();
  for (let i = 0; i < raw.brews.length; i++) {
    const b = raw.brews[i];
    const label = `Brew ${i + 1}`;
    if (!isRec(b)) return { ok: false, reason: `${label} isn't a record.` };
    for (const field of ["id", "coffeeId"] as const) {
      if (!nonEmptyString(b[field])) return { ok: false, reason: `${label} is missing a valid ${field}.` };
    }
    for (const field of BREW_REQUIRED_NUMBERS) {
      if (!finiteNumber(b[field])) return { ok: false, reason: `${label} is missing a valid ${field}.` };
    }
    for (const field of BREW_OPTIONAL_NUMBERS) {
      if (!optionalOk(b[field], "number")) return { ok: false, reason: `${label} has an invalid ${field}.` };
    }
    for (const field of BREW_OPTIONAL_STRINGS) {
      if (!optionalOk(b[field], "string")) return { ok: false, reason: `${label} has an invalid ${field}.` };
    }
    if (brewIds.has(b.id as string)) {
      return { ok: false, reason: `${label} repeats the id of an earlier brew.` };
    }
    brewIds.add(b.id as string);
    if (!coffeeIds.has(b.coffeeId as string)) {
      return { ok: false, reason: `${label} belongs to a coffee that isn't in the file.` };
    }
    brews.push(brewOut(b as unknown as Brew));
  }

  return { ok: true, payload: { coffees, brews } };
}

export function ledgerFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `brewlog-ledger-${y}-${m}-${d}.json`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/__tests__/ledgerFile.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Gates + commit**

Run: `npx tsc --noEmit` (clean) and `npx jest` (all green).

```bash
git add src/lib/ledgerFile.ts src/lib/__tests__/ledgerFile.test.ts
git commit -m "feat(data): standardized ledger file format with strict validation"
```

---

### Task 2: Transactional replace (`src/db/importLedger.ts`)

**Files:**
- Create: `src/db/importLedger.ts`
- Test: `src/db/__tests__/importLedger.test.ts`

**Interfaces:**
- Consumes: `Db` from `src/db/types.ts`; `LedgerPayload` from `src/lib/ledgerFile.ts`; `createCoffee` from `src/db/coffees.ts`; `createBrew` from `src/db/brews.ts`; test harness `makeTestDb()` from `src/db/testdb.ts`.
- Produces (Task 3 relies on this exact name): `replaceLedger(db: Db, payload: LedgerPayload): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `src/db/__tests__/importLedger.test.ts`:

```ts
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
  id, coffeeId, brewedAt: 2, doseG: 15, waterG: 250, ratio: 16.7,
  grind: null, waterTempC: null, dripper: null, pours: null, pourIntervalS: null,
  totalTimeS: null, filterType: null, tds: null, ey: null, acidity: null,
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/db/__tests__/importLedger.test.ts`
Expected: FAIL — cannot find module `../importLedger`.

- [ ] **Step 3: Implement `src/db/importLedger.ts`**

```ts
import type { Db } from "./types";
import type { LedgerPayload } from "../lib/ledgerFile";
import { createCoffee } from "./coffees";
import { createBrew } from "./brews";

// Replaces the entire ledger with the payload inside one transaction: a failure at
// any point rolls back to the pre-import state, so a poisoned file can't leave the
// user with half a ledger.
export async function replaceLedger(db: Db, payload: LedgerPayload): Promise<void> {
  await db.execAsync("BEGIN");
  try {
    await db.execAsync("DELETE FROM brews; DELETE FROM coffees;");
    for (const c of payload.coffees) await createCoffee(db, c);
    for (const b of payload.brews) await createBrew(db, b);
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/db/__tests__/importLedger.test.ts`
Expected: PASS, 3 tests green.

- [ ] **Step 5: Gates + commit**

Run: `npx tsc --noEmit` (clean) and `npx jest` (all green).

```bash
git add src/db/importLedger.ts src/db/__tests__/importLedger.test.ts
git commit -m "feat(data): transactional ledger replace for import"
```

---

### Task 3: Settings wiring — pickers, confirm flow, icon tweak

**Files:**
- Modify: `src/screens/SettingsScreen.tsx` (the two `DataAction` `onPress` stubs at lines ~78-90, plus new handlers; `trayArrowUp` style at line ~393)

**Interfaces:**
- Consumes:
  - `serializeLedger(coffees, brews, exportedAt)`, `parseLedgerFile(text)`, `ledgerFilename(date)` from `../lib/ledgerFile` (Task 1)
  - `replaceLedger(db, payload)` from `../db/importLedger` (Task 2)
  - `getDb()` from `../db/database`; `listCoffees(db)` from `../db/coffees`; `listAllBrews(db)`, `countAllBrews(db)` from `../db/brews`
  - `Directory`, `File` from `expo-file-system`; `modal.alert` / `modal.confirm` from the existing `useAppModal()` already in the component.
- Produces: nothing downstream — this is the leaf task.

No unit tests (UI glue over pickers Jest can't reach); the gate is `npx tsc --noEmit` + full `npx jest` staying green, and manual verification on the S23 happens after the feature lands.

Doc check first (AGENTS.md): confirm on https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/ that `Directory.pickDirectoryAsync()` returns `Promise<Directory>`, `File.pickFileAsync(initialUri?, mimeType?)` returns `Promise<File | File[]>`, `directory.createFile(name, mimeType)` returns a `File`, `file.write(string)` and `file.text()` exist. Both pickers **reject on cancel** — treat a picker rejection as a silent no-op.

- [ ] **Step 1: Add imports and handlers to `SettingsScreen.tsx`**

Add to the imports:

```ts
import { Directory, File } from "expo-file-system";
import { getDb } from "../db/database";
import { listCoffees } from "../db/coffees";
import { countAllBrews, listAllBrews } from "../db/brews";
import { ledgerFilename, parseLedgerFile, serializeLedger } from "../lib/ledgerFile";
import { replaceLedger } from "../db/importLedger";
```

Inside `SettingsScreen`, after `const [pickerOpen, setPickerOpen] = useState(false);`, add:

```ts
  // One data operation at a time — a double-tap must not stack two pickers.
  const busyRef = useRef(false);

  const counts = (nCoffees: number, nBrews: number) =>
    `${nCoffees} ${nCoffees === 1 ? "coffee" : "coffees"} and ${nBrews} ${nBrews === 1 ? "brew" : "brews"}`;

  const exportLedger = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      let dir: Directory;
      try {
        dir = await Directory.pickDirectoryAsync();
      } catch {
        return; // picker dismissed — the quiet outcome
      }
      const db = await getDb();
      const coffees = await listCoffees(db);
      const brews = await listAllBrews(db);
      const name = ledgerFilename(new Date());
      try {
        const file = dir.createFile(name, "application/json");
        file.write(serializeLedger(coffees, brews, new Date().toISOString()));
      } catch (e) {
        await modal.alert(
          "Couldn't save the file",
          e instanceof Error ? e.message : "Something went wrong while writing."
        );
        return;
      }
      await modal.alert("Ledger saved", `${name} holds ${counts(coffees.length, brews.length)}.`);
    } finally {
      busyRef.current = false;
    }
  };

  const importLedger = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      let picked: File | File[];
      try {
        picked = await File.pickFileAsync(undefined, "application/json");
      } catch {
        return; // picker dismissed
      }
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (!file) return;

      let text: string;
      try {
        text = await file.text();
      } catch {
        await modal.alert("Couldn't read the file", "The file couldn't be opened.");
        return;
      }

      const parsed = parseLedgerFile(text);
      if (!parsed.ok) {
        await modal.alert("Can't import this file", parsed.reason);
        return;
      }

      const db = await getDb();
      const curCoffees = (await listCoffees(db)).length;
      const curBrews = await countAllBrews(db);
      const proceed = await modal.confirm({
        title: "Replace your ledger?",
        message:
          `This file holds ${counts(parsed.payload.coffees.length, parsed.payload.brews.length)}. ` +
          `Importing replaces everything currently in Brewlog — your current ` +
          `${counts(curCoffees, curBrews)} will be lost.`,
        confirmLabel: "Replace everything",
        destructive: true,
      });
      if (!proceed) return;

      try {
        await replaceLedger(db, parsed.payload);
      } catch {
        await modal.alert(
          "Import failed",
          "Nothing was changed — your current ledger is intact."
        );
        return;
      }
      await modal.alert(
        "Ledger restored",
        `Brewlog now holds ${counts(parsed.payload.coffees.length, parsed.payload.brews.length)}.`
      );
    } finally {
      busyRef.current = false;
    }
  };
```

`useRef` is already imported in this file.

- [ ] **Step 2: Point the DataAction rows at the handlers**

Replace the two stub `onPress` props:

```tsx
          <DataAction
            title="Export ledger"
            caption="Save everything to a file"
            direction="up"
            accent
            onPress={() => void exportLedger()}
          />
          <DataAction
            title="Import ledger"
            caption="Restore from a file"
            direction="down"
            onPress={() => void importLedger()}
          />
```

- [ ] **Step 3: Tighten the export icon**

In the styles at the bottom of `SettingsScreen.tsx`, change:

```ts
  trayArrowUp: { marginBottom: 5 },
```

to:

```ts
  trayArrowUp: { marginBottom: 2 },
```

(`trayArrowDown` stays at `marginBottom: 3`.)

- [ ] **Step 4: Gates**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx jest`
Expected: all suites green (no new tests in this task; nothing should regress).

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(settings): wire ledger export/import to real files"
```
