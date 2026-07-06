# Natural-language AI-prefilled forms — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user describe a coffee or brew in one natural-language box and have the on-device QVAC LLM pre-fill the form's fields for review before saving.

**Architecture:** A pure, unit-tested layer (`src/qvac/intake.ts`) builds extraction prompts and parses the model's JSON reply into typed partials. A reusable `NaturalLanguageIntake` component runs the model via the existing `useQvac()` and returns parsed fields. Each form screen shows the box first on a *new* entry, then reveals the existing (now pre-filled) fields; edit mode skips the box.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, Jest. On-device LLM via existing `@qvac/sdk` plumbing (`QvacProvider` / `useQvac`).

## Global Constraints

- **Zero new dependencies.** Reuse `useQvac()` (`status`, `prepare`, `runAdvice`) and `ChatMessage` from `src/qvac/advisor.ts`.
- **Design system:** Artisanal Brew Ledger tokens in `src/design/tokens` (`colors`, `fonts`, `radii`, `spacing`); reuse `AppText`, `PillButton`.
- **Taste ratings are NOT parsed** (acidity, sweetness, bitterness, body, clarity, rating stay blank).
- **One-shot parse** — accumulate the full reply, then parse; do not stream partial fields.
- **Never a dead end:** an "Enter manually ›" link is always present; on model-unavailable (`status === "error"`) auto-reveal the fields.
- **Nothing is written to the DB** until the user sees the fields and taps Save (existing save/validation unchanged).
- Validate every task with `npx tsc --noEmit` and `npm test`. Commit per task on branch `human-input-form`.

## File Structure

- `src/qvac/intake.ts` *(new)* — pure: `extractJson`, `build{Coffee,Brew}IntakePrompt`, `parse{Coffee,Brew}Intake`, types `CoffeeIntake` / `BrewIntake`.
- `src/qvac/__tests__/intake.test.ts` *(new)* — unit tests for the pure layer.
- `src/components/ui/NaturalLanguageIntake.tsx` *(new)* — the box + Autofill + Stop + Enter-manually UI; runs the model.
- `src/components/ui/index.ts` *(modify)* — export the component.
- `src/screens/BrewFormScreen.tsx` *(modify)* — reveal flag + intake + `applyParsed`.
- `src/screens/CoffeeFormScreen.tsx` *(modify)* — reveal flag + intake + `applyParsed`.

---

### Task 1: Pure intake layer — JSON extraction + Brew

**Files:**
- Create: `src/qvac/intake.ts`
- Test: `src/qvac/__tests__/intake.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` from `src/qvac/advisor.ts` (`{ role: "system"|"user"|"assistant"; content: string }`).
- Produces:
  - `extractJson(raw: string): Record<string, unknown> | null`
  - `buildBrewIntakePrompt(text: string): ChatMessage[]`
  - `parseBrewIntake(raw: string): BrewIntake`
  - `type BrewIntake = { doseG?: number; waterG?: number; grind?: string; waterTempC?: number; dripper?: "V60"; pours?: number; pourIntervalS?: number; totalTimeS?: number; filterType?: "white" | "unbleached"; notes?: string }`

- [ ] **Step 1: Write the failing tests**

Create `src/qvac/__tests__/intake.test.ts`:

```ts
import { extractJson, buildBrewIntakePrompt, parseBrewIntake } from "../intake";

describe("extractJson", () => {
  it("parses a plain object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("ignores surrounding prose", () => {
    expect(extractJson('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });
  it("strips json code fences", () => {
    expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });
  it("returns null on a bare array", () => {
    expect(extractJson("[1,2,3]")).toBeNull();
  });
  it("returns null on garbage", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("buildBrewIntakePrompt", () => {
  it("is a system+user pair embedding the text and allowed values", () => {
    const m = buildBrewIntakePrompt("15g 250g v60");
    expect(m).toHaveLength(2);
    expect(m[0].role).toBe("system");
    expect(m[1].role).toBe("user");
    expect(m[1].content).toContain("15g 250g v60");
    expect(m[0].content.toLowerCase()).toContain("white");
    expect(m[0].content).toContain("V60");
  });
});

describe("parseBrewIntake", () => {
  it("maps numbers and strings from a clean object", () => {
    const r = parseBrewIntake(
      '{"doseG":15,"waterG":250,"grind":"medium-fine","waterTempC":94,"dripper":"V60","pours":3,"pourIntervalS":30,"totalTimeS":165,"filterType":"white","notes":"juicy"}'
    );
    expect(r).toEqual({
      doseG: 15, waterG: 250, grind: "medium-fine", waterTempC: 94, dripper: "V60",
      pours: 3, pourIntervalS: 30, totalTimeS: 165, filterType: "white", notes: "juicy",
    });
  });
  it("omits nulls and unknown keys", () => {
    expect(parseBrewIntake('{"doseG":15,"waterG":null,"foo":"bar"}')).toEqual({ doseG: 15 });
  });
  it("coerces numeric strings", () => {
    expect(parseBrewIntake('{"doseG":"15"}').doseG).toBe(15);
  });
  it("clamps water temp to 0-100", () => {
    expect(parseBrewIntake('{"waterTempC":999}').waterTempC).toBe(100);
    expect(parseBrewIntake('{"waterTempC":-5}').waterTempC).toBe(0);
  });
  it("drops non-positive dose/water", () => {
    expect(parseBrewIntake('{"doseG":0,"waterG":-1}')).toEqual({});
  });
  it("rounds pours and requires >= 1", () => {
    expect(parseBrewIntake('{"pours":2.6}').pours).toBe(3);
    expect(parseBrewIntake('{"pours":0}').pours).toBeUndefined();
  });
  it("normalizes filterType/dripper case and drops invalid", () => {
    expect(parseBrewIntake('{"filterType":"White","dripper":"v60"}')).toEqual({ filterType: "white", dripper: "V60" });
    expect(parseBrewIntake('{"filterType":"brown","dripper":"Kalita"}')).toEqual({});
  });
  it("returns empty on garbage", () => {
    expect(parseBrewIntake("not json")).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- intake`
Expected: FAIL — `Cannot find module '../intake'`.

- [ ] **Step 3: Implement `src/qvac/intake.ts` (extraction + brew)**

```ts
import type { ChatMessage } from "./advisor";

// Pull the first balanced {...} object out of an LLM reply that may include code
// fences, <think> remnants, or surrounding prose. Returns null if none parses to an object.
export function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const text = raw.replace(/```json/gi, "```").replace(/```/g, "");
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const v = JSON.parse(text.slice(start, i + 1));
          if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
        } catch {
          /* keep scanning for the next balanced object */
        }
        start = -1;
      }
    }
  }
  return null;
}

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
};
const numFinite = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const intGe = (v: unknown, min: number): number | undefined => {
  const n = numFinite(v);
  if (n == null) return undefined;
  const i = Math.round(n);
  return i >= min ? i : undefined;
};

export type BrewIntake = {
  doseG?: number; waterG?: number; grind?: string; waterTempC?: number;
  dripper?: "V60"; pours?: number; pourIntervalS?: number; totalTimeS?: number;
  filterType?: "white" | "unbleached"; notes?: string;
};

const BREW_KEYS_DOC =
  'doseG, waterG, grind, waterTempC, dripper (only "V60"), pours, pourIntervalS, totalTimeS, filterType ("white" or "unbleached"), notes';

export function buildBrewIntakePrompt(text: string): ChatMessage[] {
  const system = [
    "You convert a coffee lover's freeform description of a pour-over brew into JSON.",
    `Return ONLY a JSON object with these keys: ${BREW_KEYS_DOC}.`,
    "Use null for anything not stated. Do not invent values.",
    'dripper may only be "V60". filterType may only be "white" or "unbleached".',
    "doseG, waterG, waterTempC, pours, pourIntervalS, totalTimeS are numbers.",
    "notes holds any leftover taste/descriptive prose. Do not rate the taste.",
  ].join("\n");
  return [{ role: "system", content: system }, { role: "user", content: `Description:\n${text}` }];
}

export function parseBrewIntake(raw: string): BrewIntake {
  const o = extractJson(raw);
  if (!o) return {};
  const out: BrewIntake = {};
  const dose = numFinite(o.doseG); if (dose != null && dose > 0) out.doseG = dose;
  const water = numFinite(o.waterG); if (water != null && water > 0) out.waterG = water;
  const grind = str(o.grind); if (grind) out.grind = grind;
  const temp = numFinite(o.waterTempC); if (temp != null) out.waterTempC = Math.min(100, Math.max(0, temp));
  if (str(o.dripper)?.toLowerCase() === "v60") out.dripper = "V60";
  const pours = intGe(o.pours, 1); if (pours != null) out.pours = pours;
  const interval = intGe(o.pourIntervalS, 0); if (interval != null) out.pourIntervalS = interval;
  const total = intGe(o.totalTimeS, 0); if (total != null) out.totalTimeS = total;
  const filter = str(o.filterType)?.toLowerCase();
  if (filter === "white" || filter === "unbleached") out.filterType = filter;
  const notes = str(o.notes); if (notes) out.notes = notes;
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- intake`
Expected: PASS (all `extractJson`, `buildBrewIntakePrompt`, `parseBrewIntake` tests green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/qvac/intake.ts src/qvac/__tests__/intake.test.ts
git commit -m "feat(intake): JSON extraction + brew prompt/parser"
```

---

### Task 2: Pure intake layer — Coffee

**Files:**
- Modify: `src/qvac/intake.ts`
- Test: `src/qvac/__tests__/intake.test.ts`

**Interfaces:**
- Consumes: `extractJson`, `str` helper pattern from Task 1 (same file).
- Produces:
  - `buildCoffeeIntakePrompt(text: string): ChatMessage[]`
  - `parseCoffeeIntake(raw: string): CoffeeIntake`
  - `type CoffeeIntake = { roaster?: string; name?: string; origin?: string; process?: string; roastLevel?: string; roastDate?: string; notes?: string }`

- [ ] **Step 1: Add the failing tests**

Append to `src/qvac/__tests__/intake.test.ts`:

```ts
import { buildCoffeeIntakePrompt, parseCoffeeIntake } from "../intake";

describe("buildCoffeeIntakePrompt", () => {
  it("is a system+user pair embedding the text and key list", () => {
    const m = buildCoffeeIntakePrompt("Sey Kenya washed");
    expect(m).toHaveLength(2);
    expect(m[1].content).toContain("Sey Kenya washed");
    expect(m[0].content).toContain("roastDate");
  });
});

describe("parseCoffeeIntake", () => {
  it("maps and trims fields", () => {
    expect(
      parseCoffeeIntake('{"roaster":" Sey ","name":"Kenya","origin":"Kenya","process":"washed","roastLevel":"light","roastDate":"2026-06-10","notes":"floral"}')
    ).toEqual({ roaster: "Sey", name: "Kenya", origin: "Kenya", process: "washed", roastLevel: "light", roastDate: "2026-06-10", notes: "floral" });
  });
  it("drops a malformed roastDate", () => {
    expect(parseCoffeeIntake('{"roastDate":"June 10"}')).toEqual({});
  });
  it("omits nulls and empty strings", () => {
    expect(parseCoffeeIntake('{"roaster":"Sey","name":null,"origin":""}')).toEqual({ roaster: "Sey" });
  });
  it("returns empty on garbage", () => {
    expect(parseCoffeeIntake("nope")).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- intake`
Expected: FAIL — `buildCoffeeIntakePrompt`/`parseCoffeeIntake` are not exported.

- [ ] **Step 3: Append the coffee implementation to `src/qvac/intake.ts`**

```ts
export type CoffeeIntake = {
  roaster?: string; name?: string; origin?: string; process?: string;
  roastLevel?: string; roastDate?: string; notes?: string;
};

const COFFEE_KEYS_DOC =
  "roaster, name, origin, process (e.g. washed/natural/honey), roastLevel (e.g. light/medium), roastDate (YYYY-MM-DD), notes";

export function buildCoffeeIntakePrompt(text: string): ChatMessage[] {
  const system = [
    "You convert a coffee lover's freeform description of a bag of coffee into JSON.",
    `Return ONLY a JSON object with these keys: ${COFFEE_KEYS_DOC}.`,
    "Use null for anything not stated. Do not invent values.",
    "roastDate must be YYYY-MM-DD or null. notes holds any leftover descriptive/tasting prose.",
  ].join("\n");
  return [{ role: "system", content: system }, { role: "user", content: `Description:\n${text}` }];
}

export function parseCoffeeIntake(raw: string): CoffeeIntake {
  const o = extractJson(raw);
  if (!o) return {};
  const out: CoffeeIntake = {};
  const roaster = str(o.roaster); if (roaster) out.roaster = roaster;
  const name = str(o.name); if (name) out.name = name;
  const origin = str(o.origin); if (origin) out.origin = origin;
  const process = str(o.process); if (process) out.process = process;
  const roastLevel = str(o.roastLevel); if (roastLevel) out.roastLevel = roastLevel;
  const roastDate = str(o.roastDate);
  if (roastDate && /^\d{4}-\d{2}-\d{2}$/.test(roastDate)) out.roastDate = roastDate;
  const notes = str(o.notes); if (notes) out.notes = notes;
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- intake`
Expected: PASS (coffee + brew + extractJson suites all green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/qvac/intake.ts src/qvac/__tests__/intake.test.ts
git commit -m "feat(intake): coffee prompt/parser"
```

---

### Task 3: `NaturalLanguageIntake` component

**Files:**
- Create: `src/components/ui/NaturalLanguageIntake.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `useQvac()` (`status`, `prepare`, `runAdvice`); `ChatMessage`; `AppText`, `PillButton`; tokens.
- Produces:
  - `NaturalLanguageIntake<T>(props: { kicker: string; placeholder: string; buildPrompt: (text: string) => ChatMessage[]; parse: (raw: string) => T; onParsed: (parsed: T) => void; onManual: () => void }): JSX.Element`

> No unit test — this is a device/QVAC-bound component. Gate is `npx tsc --noEmit`; behavior is verified on-device in Task 6.

- [ ] **Step 1: Create the component**

Create `src/components/ui/NaturalLanguageIntake.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "./AppText";
import { PillButton } from "./PillButton";
import { useQvac } from "../../qvac/QvacProvider";
import type { ChatMessage } from "../../qvac/advisor";
import { colors, fonts, radii, spacing } from "../../design/tokens";

export type NaturalLanguageIntakeProps<T> = {
  kicker: string;
  placeholder: string;
  buildPrompt: (text: string) => ChatMessage[];
  parse: (raw: string) => T;
  onParsed: (parsed: T) => void;
  onManual: () => void;
};

// One natural-language box that runs the on-device model once and hands the parsed
// fields back to the screen. The screen reveals its structured fields on `onParsed`.
export function NaturalLanguageIntake<T>({
  kicker, placeholder, buildPrompt, parse, onParsed, onManual,
}: NaturalLanguageIntakeProps<T>) {
  const { status, prepare, runAdvice } = useQvac();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "preparing" | "running" | "error">("idle");
  const wantRun = useRef(false);
  const running = useRef(false);
  const canceled = useRef(false);
  const cancelRun = useRef<null | (() => void)>(null);
  const buf = useRef("");

  function beginRun() {
    if (running.current) return;
    running.current = true;
    canceled.current = false;
    buf.current = "";
    setPhase("running");
    const run = runAdvice(buildPrompt(text), {
      onContent: (t) => { buf.current += t; },
      onThinking: () => {},
    });
    cancelRun.current = run.cancel;
    run.done
      .then(() => { if (!canceled.current) onParsed(parse(buf.current)); })
      .catch(() => { if (!canceled.current) setPhase("error"); })
      .finally(() => { running.current = false; });
  }

  // When the model becomes ready after an Autofill tap, start the run. If it can't
  // load at all, fall back to manual entry (never a dead end).
  useEffect(() => {
    if (!wantRun.current) return;
    if (status === "ready") { wantRun.current = false; beginRun(); }
    else if (status === "error") { wantRun.current = false; onManual(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function onAutofill() {
    if (!text.trim() || phase === "running" || phase === "preparing") return;
    prepare();
    if (status === "ready") beginRun();
    else { wantRun.current = true; setPhase("preparing"); }
  }

  function onStop() {
    canceled.current = true;
    cancelRun.current?.();
    wantRun.current = false;
    running.current = false;
    setPhase("idle");
  }

  const busy = phase === "preparing" || phase === "running";

  return (
    <View style={styles.wrap}>
      <AppText variant="labelSm" style={styles.kicker}>✦ {kicker}</AppText>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        multiline
        editable={!busy}
      />

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="bodyMd" style={styles.busyText}>
            {phase === "preparing" ? "Preparing advisor…" : "Reading your description…"}
          </AppText>
        </View>
      ) : null}

      {phase === "error" ? (
        <AppText variant="bodyMd" style={styles.error}>
          ✕ Couldn't reach the advisor. Tap “Enter manually” below.
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {busy ? (
          <PillButton label="Stop" variant="danger" onPress={onStop} />
        ) : (
          <PillButton label="Autofill with AI" onPress={onAutofill} />
        )}
      </View>

      {!busy ? (
        <AppText variant="labelMd" style={styles.manual} onPress={onManual} suppressHighlighting>
          Enter manually ›
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.section, gap: spacing.gutter },
  kicker: { color: colors.primary },
  input: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 23,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 120,
    textAlignVertical: "top",
  },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  busyText: { color: colors.onSurfaceVariant },
  error: { color: colors.tertiary },
  actions: { marginTop: spacing.base },
  manual: { color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.base },
});
```

- [ ] **Step 2: Export it**

In `src/components/ui/index.ts`, add after the `ReasoningDisclosure` export line:

```ts
export { NaturalLanguageIntake, type NaturalLanguageIntakeProps } from "./NaturalLanguageIntake";
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/NaturalLanguageIntake.tsx src/components/ui/index.ts
git commit -m "feat(intake): NaturalLanguageIntake component"
```

---

### Task 4: Wire the Brew form

**Files:**
- Modify: `src/screens/BrewFormScreen.tsx`

**Interfaces:**
- Consumes: `NaturalLanguageIntake`, `buildBrewIntakePrompt`, `parseBrewIntake`, `BrewIntake`.

- [ ] **Step 1: Add imports**

In `src/screens/BrewFormScreen.tsx`, extend the UI import and add the intake import. Change:

```tsx
import { AppText, TextField, ChipSelect, ScaleSelect, PillButton, type ChipOption } from "../components/ui";
```
to:
```tsx
import { AppText, TextField, ChipSelect, ScaleSelect, PillButton, NaturalLanguageIntake, type ChipOption } from "../components/ui";
import { buildBrewIntakePrompt, parseBrewIntake, type BrewIntake } from "../qvac/intake";
```

- [ ] **Step 2: Add reveal state + applyParsed**

Immediately after the `const editingId = params.brewId;` line, add:

```tsx
  const [revealed, setRevealed] = useState(!!editingId);
```

Then, just before the `async function onSave()` declaration, add:

```tsx
  function applyParsed(p: BrewIntake) {
    if (p.doseG != null) setDose(String(p.doseG));
    if (p.waterG != null) setWater(String(p.waterG));
    if (p.grind) setGrind(p.grind);
    if (p.waterTempC != null) setTemp(String(p.waterTempC));
    if (p.dripper) setDripper(p.dripper);
    if (p.pours != null) setPours(String(p.pours));
    if (p.pourIntervalS != null) setPourInterval(String(p.pourIntervalS));
    if (p.totalTimeS != null) setTotalTime(String(p.totalTimeS));
    if (p.filterType) setFilterType(p.filterType);
    if (p.notes) setNotes(p.notes);
    setRevealed(true);
  }
```

- [ ] **Step 3: Gate the body on `revealed`**

In the returned JSX, the back-arrow `topBar` block stays as-is. Replace the block that begins with `<View style={styles.hero}>` and continues through the closing `</View>` of `styles.actions` with a conditional. The new structure (keep the existing inner JSX verbatim inside the `revealed` branch):

```tsx
        {!revealed ? (
          <NaturalLanguageIntake
            kicker="Describe your brew"
            placeholder="15g in, 250g out, V60, 94°C, 3 pours about 30s apart, ~2:45 total. Bright and juicy."
            buildPrompt={buildBrewIntakePrompt}
            parse={parseBrewIntake}
            onParsed={applyParsed}
            onManual={() => setRevealed(true)}
          />
        ) : (
          <>
            <View style={styles.hero}>
              {/* ...existing hero (kicker + ratio + caption) unchanged... */}
            </View>
            {/* ...existing Recipe / Process / Taste / Notes sections unchanged... */}
            <View style={styles.actions}>
              <PillButton label={editingId ? "Save changes" : "Save brew"} onPress={onSave} />
              {editingId ? <PillButton label="Delete brew" variant="danger" onPress={onDelete} style={styles.delete} /> : null}
            </View>
          </>
        )}
```

> Practical note for the implementer: wrap the **existing** hero+sections+actions JSX (everything currently between the `topBar` `</View>` and the `</ScrollView>`) in the `revealed ?` `<> … </>` branch. Do not retype the section bodies — move them as-is.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Run the full test suite (no regressions)**

Run: `npm test`
Expected: PASS (all suites, including `intake`).

- [ ] **Step 6: Commit**

```bash
git add src/screens/BrewFormScreen.tsx
git commit -m "feat(intake): natural-language box on the brew form"
```

---

### Task 5: Wire the Coffee form

**Files:**
- Modify: `src/screens/CoffeeFormScreen.tsx`

**Interfaces:**
- Consumes: `NaturalLanguageIntake`, `buildCoffeeIntakePrompt`, `parseCoffeeIntake`, `CoffeeIntake`.

- [ ] **Step 1: Add imports**

Change:
```tsx
import { AppText, TextField, PillButton } from "../components/ui";
```
to:
```tsx
import { AppText, TextField, PillButton, NaturalLanguageIntake } from "../components/ui";
import { buildCoffeeIntakePrompt, parseCoffeeIntake, type CoffeeIntake } from "../qvac/intake";
```

- [ ] **Step 2: Add reveal state + applyParsed**

After `const editingId = params?.coffeeId;`, add:

```tsx
  const [revealed, setRevealed] = useState(!!editingId);
```

Before `async function onSave()`, add:

```tsx
  function applyParsed(p: CoffeeIntake) {
    if (p.roaster) setRoaster(p.roaster);
    if (p.name) setName(p.name);
    if (p.origin) setOrigin(p.origin);
    if (p.process) setProcess(p.process);
    if (p.roastLevel) setRoastLevel(p.roastLevel);
    if (p.roastDate) setRoastDate(p.roastDate);
    if (p.notes) setNotes(p.notes);
    setRevealed(true);
  }
```

- [ ] **Step 3: Gate the body on `revealed`**

Keep the `topBar` + kicker + serif title block as-is. Wrap everything from the hero `<View style={styles.heroWrap}>` through the `</View>` of `styles.actions` in a `revealed` conditional, with the intake as the `!revealed` branch:

```tsx
        {!revealed ? (
          <NaturalLanguageIntake
            kicker="Describe this coffee"
            placeholder="Sey Coffee, Kenya Nyeri AA, washed, light roast, roasted 2026-06-10. Blackcurrant and floral."
            buildPrompt={buildCoffeeIntakePrompt}
            parse={parseCoffeeIntake}
            onParsed={applyParsed}
            onManual={() => setRevealed(true)}
          />
        ) : (
          <>
            <View style={styles.heroWrap}>
              {/* ...existing <Image> hero unchanged... */}
            </View>
            {/* ...existing The bean / Details / Notes sections unchanged... */}
            <View style={styles.actions}>
              <PillButton label={editingId ? "Save changes" : "Save coffee"} onPress={onSave} />
              {editingId ? <PillButton label="Delete coffee" variant="danger" onPress={onDelete} style={styles.delete} /> : null}
            </View>
          </>
        )}
```

> Move the existing hero+sections+actions JSX into the `revealed` branch verbatim; do not retype field bodies.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/CoffeeFormScreen.tsx
git commit -m "feat(intake): natural-language box on the coffee form"
```

---

### Task 6: Integration validation + on-device smoke

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + tests + bundle**

Run:
```bash
npx tsc --noEmit && npm test && npx expo export --platform android --output-dir /tmp/intake-export
```
Expected: tsc exit 0; all jest suites pass; Android bundle exports without error.

- [ ] **Step 2: Reload on device (Metro running, `adb reverse tcp:8081 tcp:8081` set)**

```bash
adb shell am force-stop com.anonymous.brewlog && adb shell monkey -p com.anonymous.brewlog -c android.intent.category.LAUNCHER 1
```

- [ ] **Step 3: Manual smoke checklist (physical S23)**

  - New coffee (`Add coffee`): box shows; type "Sey, Kenya Nyeri AA, washed, light, roasted 2026-06-10, blackcurrant" → **Autofill** → fields reveal pre-filled (roaster/name/origin/process/roastLevel/roastDate/notes); edit one; **Save**; appears in list.
  - New brew (coffee → `Log brew`): type "15g, 250g, V60, 94C, 3 pours 30s apart, 2:45, juicy and bright" → **Autofill** → recipe fields filled, taste blank, notes carries prose; **Save brew**; row shows correct ratio.
  - **Enter manually ›** on a fresh brew → empty fields appear, manual entry + Save works.
  - **Stop** mid-run → returns to idle box, no crash.
  - **Edit** an existing coffee and brew → no box; fields pre-filled from DB as before.

- [ ] **Step 4: Commit the plan completion (docs only, if anything changed) and finish**

```bash
git add -A
git commit -m "docs: mark natural-language intake plan complete" || echo "nothing to commit"
```

---

## Self-Review

- **Spec coverage:** UX flow (box-first, reveal, manual link, edit skip) → Tasks 3–5. Manual/error fallback → component effect (`status==="error"` → `onManual`) + parse-empty reveal, Task 3. JSON contract (coffee/brew tables) → Tasks 1–2 parsers. Objective-only (no taste) → brew parser omits taste; covered. Testing → Tasks 1–2 unit tests + Task 6 smoke. All spec sections map to a task.
- **Placeholder scan:** the only `/* ... */` notes are explicit "move existing JSX verbatim" instructions with the surrounding new code shown — not unfinished logic. No TBD/TODO.
- **Type consistency:** `BrewIntake`/`CoffeeIntake` field names match the `applyParsed` setters and the parser outputs; `buildBrewIntakePrompt`/`parseBrewIntake`/`buildCoffeeIntakePrompt`/`parseCoffeeIntake` names are consistent across Tasks 1–5; `NaturalLanguageIntake` prop names match call sites.
