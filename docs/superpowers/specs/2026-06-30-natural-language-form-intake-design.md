# Natural-language → AI-prefilled forms

**Date:** 2026-06-30
**Branch:** `human-input-form`
**Status:** Approved design

## Overview

Replace the "type into every field" first step of the Coffee and Brew forms with a
natural-language intake: the user describes their coffee/brew in one freeform box, the
on-device QVAC LLM extracts the structured values, and the existing form fields are then
revealed **pre-filled and editable** for review before saving.

This is additive — it changes how fields get their *initial* values on a **new** entry. The
existing structured fields, validation, save/delete logic, and DB schema are unchanged.

## Goals

- One natural-language box that pre-fills a new Coffee or Brew form via the on-device model.
- The user always reviews/edits the parsed values before anything is written to the DB.
- Never a dead end: works (manually) on emulator, on model failure, or for users who prefer typing.
- Small, pure, unit-testable parsing/prompt logic, mirroring the existing `advisor.ts` + `advisor.test.ts` pattern.

## Non-goals (out of scope)

- Inferring subjective taste ratings (acidity/sweetness/bitterness/body/clarity/overall). These stay blank for the user to set.
- Changing edit mode — editing an existing record skips the box entirely (see below).
- Streaming partial fields into the form. The parse is one-shot.
- Any DB schema / model-loading changes. Reuses `useQvac()` as-is.
- A "refine with AI" box in edit mode.

## UX flow

### New entry
1. Screen opens showing only: a `✦ Describe your coffee/brew` multiline box, an **Autofill** button, and an **Enter manually ›** link. Structured fields are hidden (`revealed = false`).
2. **Autofill** → ensure model (`prepare()`), wait for ready (showing "Preparing advisor…" then "Reading…"), run one inference. A **Stop** cancels an in-flight run.
3. On success → parse the reply, map values onto field state, set `revealed = true`. Fields appear pre-filled and editable; user reviews and taps **Save** (existing logic).
4. **Enter manually ›** → `revealed = true` with empty fields, no AI call.
5. On model-unavailable / model-error / unparseable reply → show a one-line inline note and auto-reveal the (empty or best-effort) fields. The form is never blocked.

### Edit
- No intake box. Fields are shown pre-filled from the DB exactly as today (`revealed = true` from mount). The intake is a new-entry feature only.

### States of the intake component
- `idle` — box editable, Autofill enabled when text is non-empty.
- `preparing` / `running` — spinner + caption ("Preparing advisor…" / "Reading…"); **Stop** shown.
- `error` — inline cherry note; fields auto-revealed for manual entry.
- (success transitions the screen to `revealed`, unmounting the box.)

## Architecture

Three small units; existing screens gain a reveal flag + an apply step.

### `src/qvac/intake.ts` (pure, no LLM — unit tested)
- `buildCoffeeIntakePrompt(text: string): ChatMessage[]`
- `buildBrewIntakePrompt(text: string): ChatMessage[]`
  - Each returns `[{role:"system",...},{role:"user", content: text-wrapped...}]`. The system prompt instructs: return ONLY a JSON object with the exact listed keys; use `null` when a value is not stated; do not invent values; for constrained fields use only the allowed values.
- `parseCoffeeIntake(raw: string): CoffeeIntake`
- `parseBrewIntake(raw: string): BrewIntake`
  - `raw` is the model's full content reply. Parsing:
    1. **Extract JSON** — strip ```` ```json ```` / ```` ``` ```` fences; take the first balanced `{...}` object (brace-matching scan) so surrounding prose is ignored.
    2. `JSON.parse`; on failure return an all-empty result (signals "couldn't read").
    3. **Coerce & normalize** per field (below); ignore unknown keys; `null`/missing → omitted.
  - Returns a typed partial where present keys carry validated values. Types: numerics as `number`, text as `string`, constrained as their enum.

`ChatMessage` is the existing type from `advisor.ts`.

### `src/components/ui/NaturalLanguageIntake.tsx`
- Props:
  - `placeholder: string`
  - `buildPrompt: (text: string) => ChatMessage[]`
  - `parse: (raw: string) => T`
  - `onParsed: (parsed: T) => void`
  - `onManual: () => void`
- Internals: `useQvac()` for `status`, `prepare`, `runAdvice`. On Autofill: `prepare()`, wait for `status === "ready"` (poll, same pattern as `AdvisorResultScreen`), then `runAdvice(buildPrompt(text), handlers)`, accumulating `onContent` into a buffer (ignoring `onThinking`). On `done`: `onParsed(parse(buffer))`. On error / model `"error"`: surface inline note and call `onManual()` (auto-reveal). Holds a `cancel` ref for **Stop**.
- Styled in the Artisanal Brew Ledger system (reuses `AppText`, `TextField`-like input, `PillButton`).

### Screen wiring (`CoffeeFormScreen`, `BrewFormScreen`)
- Add `const [revealed, setRevealed] = useState(!!editingId)` — edit mode starts revealed.
- When `!revealed`: render `<NaturalLanguageIntake>` (with the form's `buildPrompt`/`parse`) and the masthead; hide fields.
- `applyParsed(parsed)`: set each existing field state from `parsed` (numbers → `String(n)`, enums lowercased to match option values, leave others as current empty default), then `setRevealed(true)`.
- `onManual`: `setRevealed(true)`.
- When `revealed`: render the existing fields + Save/Delete unchanged.

## JSON contract

### Coffee — `CoffeeIntake`
| key | type | normalization |
|---|---|---|
| `roaster` | string | trim |
| `name` | string | trim |
| `origin` | string | trim |
| `process` | string | trim (e.g. washed/natural/honey) |
| `roastLevel` | string | trim (e.g. light/medium) |
| `roastDate` | string \| null | only if it matches `YYYY-MM-DD`, else omit |
| `notes` | string | trim; descriptive prose |

### Brew — `BrewIntake`
| key | type | normalization |
|---|---|---|
| `doseG` | number | finite > 0 else omit |
| `waterG` | number | finite > 0 else omit |
| `grind` | string | trim |
| `waterTempC` | number | finite, clamp 0–100 |
| `dripper` | "V60" | only allowed value; else omit |
| `pours` | number | integer ≥ 1 else omit |
| `pourIntervalS` | number | integer ≥ 0 else omit |
| `totalTimeS` | number | integer ≥ 0 else omit |
| `filterType` | "white" \| "unbleached" | lowercase-match, else omit |
| `notes` | string | trim; leftover taste/descriptive prose |

Taste ratings (`acidity, sweetness, bitterness, body, clarity, rating`) are **not** parsed.

## Error handling

- **Model not ready / unavailable (emulator):** Autofill shows "Preparing advisor…"; if `status` reaches `"error"`, show inline note and `onManual()` (reveal empty fields).
- **Inference error / cancel:** stop, show note (cancel = silent), keep box for retry; manual link always available.
- **Unparseable reply:** `parse` returns empty → inline "Couldn't read that — fill the fields below" and auto-reveal.
- **Nothing reaches the DB** without the user seeing the fields and tapping Save.

## Testing

Unit tests (`src/qvac/__tests__/intake.test.ts`), no LLM:
- `buildCoffeeIntakePrompt` / `buildBrewIntakePrompt`: 2 messages (system then user), the user text is embedded, the field list / allowed values appear in the system prompt.
- `parseBrewIntake` / `parseCoffeeIntake`:
  - plain JSON object → typed values.
  - fenced ```` ```json … ``` ```` → parsed.
  - JSON with surrounding prose / thinking remnants → extracted via brace scan.
  - `null` and missing keys → omitted.
  - out-of-range (temp 999, dose 0/negative, non-integer pours) → clamped/omitted per table.
  - bad `filterType` / `dripper` → omitted.
  - unknown keys → ignored.
  - non-JSON garbage → empty result.

Then: `npx tsc --noEmit`, `npm test`, and on-device smoke (Autofill, Enter manually, emulator/error fallback) on the S23.

## Affected files

- New: `src/qvac/intake.ts`, `src/components/ui/NaturalLanguageIntake.tsx`, `src/qvac/__tests__/intake.test.ts`.
- Edit: `src/components/ui/index.ts` (export), `src/screens/CoffeeFormScreen.tsx`, `src/screens/BrewFormScreen.tsx`.
- Unchanged: DB layer, models, `QvacProvider`, `advisor.ts`, taste components.
