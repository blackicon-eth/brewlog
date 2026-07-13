import type { Brew, Coffee } from "../models/types";
import { isBrewMethodId, methodSpec } from "./brewMethods";

// The standardized ledger file: a versioned JSON envelope around the camel-case
// domain models. Pure module — no Expo imports — so Jest covers every branch.
export const LEDGER_FORMAT = "brewlog-ledger";
export const LEDGER_VERSION = 2;

export type LedgerPayload = { coffees: Coffee[]; brews: Brew[] };
export type LedgerParseResult =
  | { ok: true; payload: LedgerPayload }
  | { ok: false; reason: string };

// Field lists drive both serialization (whitelist — join extras like BrewWithCoffee's
// roaster/coffeeName can never leak into the file) and validation.
const COFFEE_OPTIONAL_STRINGS = ["origin", "process", "roastLevel", "roastDate", "notes"] as const;
const BREW_REQUIRED_NUMBERS = ["brewedAt", "doseG", "waterG", "ratio", "createdAt"] as const;
const BREW_OPTIONAL_NUMBERS = [
  "waterTempC", "pours", "pourIntervalS", "totalTimeS",
  "acidity", "sweetness", "bitterness", "body", "clarity", "rating",
] as const;
const BREW_OPTIONAL_STRINGS = ["grind", "dripper", "filterType", "notes"] as const;

function coffeeOut(c: Coffee): Required<Coffee> {
  return {
    id: c.id, roaster: c.roaster, name: c.name,
    origin: c.origin ?? null, process: c.process ?? null, roastLevel: c.roastLevel ?? null,
    roastDate: c.roastDate ?? null, notes: c.notes ?? null,
    archived: c.archived === true, createdAt: c.createdAt,
  };
}

function brewOut(b: Brew): Required<Brew> {
  return {
    id: b.id, coffeeId: b.coffeeId, brewedAt: b.brewedAt,
    method: methodSpec(b.method).id,
    doseG: b.doseG, waterG: b.waterG, ratio: b.ratio,
    grind: b.grind ?? null, waterTempC: b.waterTempC ?? null, dripper: b.dripper ?? null,
    pours: b.pours ?? null, pourIntervalS: b.pourIntervalS ?? null,
    totalTimeS: b.totalTimeS ?? null, filterType: b.filterType ?? null,
    preheat: typeof b.preheat === "boolean" ? b.preheat : null,
    heat: b.heat === "low" || b.heat === "medium" || b.heat === "high" ? b.heat : null,
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
  const fileVersion = raw.version as number;

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
    if (!(c.archived === undefined || c.archived === null || typeof c.archived === "boolean")) {
      return { ok: false, reason: `${label} has an invalid archived flag.` };
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
    if (fileVersion >= 2) {
      // "v60" is the pre-rename id for filter brews — old v2 exports carry it, and
      // brewOut normalizes it to "filter" on ingest.
      if (!isBrewMethodId(b.method) && b.method !== "v60") {
        return { ok: false, reason: `${label} has an invalid method.` };
      }
      if (!(b.preheat === undefined || b.preheat === null || typeof b.preheat === "boolean")) {
        return { ok: false, reason: `${label} has an invalid preheat.` };
      }
      if (!(b.heat === undefined || b.heat === null || b.heat === "low" || b.heat === "medium" || b.heat === "high")) {
        return { ok: false, reason: `${label} has an invalid heat.` };
      }
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
