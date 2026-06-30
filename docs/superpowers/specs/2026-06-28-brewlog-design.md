# Brewlog — On-device Filter Coffee Journal + AI Advisor

**Date:** 2026-06-28
**Status:** Approved design (pre-implementation)

## 1. Summary

Brewlog is a pour-over (filter) coffee journal that runs **entirely on-device**. The
user logs coffee beans and their brews of each bean, and an on-device LLM (via the
QVAC SDK) advises them using **their own logged data** — no cloud, fully offline.

Two goals, equally weighted:

1. A tool the user (a specialty-coffee fan) would actually use.
2. A showcase for the QVAC team: an LLM reasoning over private, structured user data,
   fully offline, on a phone.

## 2. Goals & non-goals

### Goals (MVP)
- Log and browse **coffees** (beans) and **brews** (tests) under each coffee.
- **Diagnose** (per brew): the AI suggests how to improve the *next* brew of *that*
  coffee, using recent brews of that coffee plus the selected brew's tasting notes.
- **Best recipe** (per coffee): the AI analyses *all* brews of a bean and proposes the
  optimal recipe, citing which past brews support it.
- Everything works offline on a physical device.

### Non-goals (explicitly deferred)
- Trend reports across the whole journal.
- RAG / embeddings over brews (the MVP injects brews directly into the prompt).
- Photos, refractometer/TDS hardware sync, data export/sync, voice.
- Espresso or other brew methods (pour-over only).
- Charts / analytics dashboards.

## 3. Target platform

- **Primary device:** Samsung Galaxy S23 (Snapdragon 8 Gen 2, 8 GB RAM, Adreno 740).
  QVAC uses Vulkan/OpenCL on Adreno 700+, so GPU acceleration is available.
- **Physical device only** — QVAC cannot run on Android emulators / iOS simulators
  (a `llama.cpp` limitation). This is a hard constraint and affects testing (§9).
- iOS is not a target for the MVP but the stack is iOS-compatible if wanted later.

## 4. Stack

- Existing Expo SDK 54 / React Native 0.81 / TypeScript scaffold.
- `@qvac/sdk` (latest, currently 0.13.5) — installed plain via `npm i @qvac/sdk`; do
  **not** copy the tutorial's stale pinned peer-dep block (tutorial pins 0.7.0). Follow
  the **installation** page's Expo steps and let npm resolve current peer deps
  (`bare-link`, `pear-pipe`, `react-native-bare-kit`, `expo-build-properties`,
  `expo-device`, `expo-file-system`, `tsx`).
- `app.json` plugins: `["expo-build-properties", { "android": { "minSdkVersion": 29 }}]`
  and `"@qvac/sdk/expo-plugin"`, then `npx expo prebuild`.
- `expo-sqlite` for persistence.
- `@react-navigation/native-stack` (+ `@react-navigation/native`, `react-native-screens`,
  `react-native-safe-area-context`) for navigation. (Chosen over expo-router to avoid
  restructuring the single-`App.tsx` scaffold into an `app/` directory.)

## 5. Model

- **Default:** `QWEN3_4B_INST_Q4_K_M` (~2.5 GB Q4), loaded with
  `modelType: "llm"`, `modelConfig: { device: "gpu", ctx_size: 4096, verbosity: ERROR }`.
  Strong reasoner that fits the S23's 8 GB with headroom and runs on the GPU.
- **Thinking mode:** Qwen3 supports a `<think>` reasoning phase; enable
  `captureThinking: true` on `completion()` so the model reasons before answering.
  Thinking output is consumed via `thinkingDelta` events and shown in a collapsible
  "reasoning" section (or hidden), separate from the final answer (`contentDelta`).
- **Fallback (config flag, not a UI feature):** `QWEN3_1_7B_INST_Q4` (~1.1 GB) for a
  faster/cooler option. The model constant lives in one config constant so switching is
  a one-line change.
- The 8B (`QWEN3_8B_INST_Q4_K_M`, ~4.7 GB) is intentionally **not** used on the 8 GB S23
  (tight RAM, slower, thermal throttling, OOM-kill risk).

## 6. Data model (SQLite)

Two tables. All ids are app-generated strings (e.g. timestamp+random) for stable list
keys. Timestamps stored as ISO strings or epoch ms.

### `coffees`
| column | type | notes |
|---|---|---|
| id | TEXT PK | |
| roaster | TEXT | |
| name | TEXT | |
| origin | TEXT | nullable |
| process | TEXT | washed / natural / honey / other (nullable) |
| roast_level | TEXT | light / medium-light / medium / medium-dark / dark (nullable) |
| roast_date | TEXT | date (nullable) — enables "days off roast" |
| notes | TEXT | nullable |
| created_at | INTEGER | epoch ms |

### `brews`
| column | type | notes |
|---|---|---|
| id | TEXT PK | |
| coffee_id | TEXT FK → coffees.id | ON DELETE CASCADE |
| brewed_at | INTEGER | epoch ms |
| dose_g | REAL | grams of coffee |
| water_g | REAL | grams of water |
| ratio | REAL | derived = water_g / dose_g, stored for convenience |
| grind | TEXT | grinder-agnostic setting/descriptor |
| water_temp_c | REAL | nullable |
| dripper | TEXT | V60 / Kalita / Origami / Chemex / other (nullable) |
| bloom_water_g | REAL | nullable |
| bloom_time_s | INTEGER | nullable |
| total_time_s | INTEGER | nullable |
| agitation | TEXT | none / swirl / stir / other (nullable) |
| filter_type | TEXT | nullable |
| tds | REAL | optional (refractometer) |
| ey | REAL | optional extraction yield % |
| acidity | INTEGER | 1–5 (nullable) |
| sweetness | INTEGER | 1–5 (nullable) |
| bitterness | INTEGER | 1–5 (nullable) |
| body | INTEGER | 1–5 (nullable) |
| clarity | INTEGER | 1–5 (nullable) |
| rating | INTEGER | 1–5 overall (nullable) |
| notes | TEXT | freeform tasting notes (nullable) |
| created_at | INTEGER | epoch ms |

Deleting a coffee cascades to its brews.

## 7. Screens (navigation stack)

1. **Coffees** (home): list of beans (name, roaster, brew count, avg rating). FAB
   "Add coffee". Header shows advisor status: `Ready` / `Preparing… (NN%)` / `Error`.
2. **Add/Edit coffee**: the bean form (§6 `coffees`).
3. **Coffee detail**: bean header; **"Best recipe"** button; list of brews
   (date · ratio · grind · total time · rating); FAB "Log brew"; each brew row exposes
   a **"Diagnose"** action.
4. **Add/Edit brew**: the brew form; auto-computes `ratio` from dose + water.
5. **Advisor result** (modal): streamed token-by-token output — the QVAC "magic"
   moment. Shows an optional collapsible reasoning section (thinking) + the final
   suggestion. Header summarises the context used (which bean, how many brews).

## 8. QVAC integration

A single service module (`qvac` service) encapsulates all SDK use; the rest of the app
never imports `@qvac/sdk` directly.

### Model lifecycle
- **Lazy loading:** the journal (all CRUD) works instantly. The model
  downloads/loads in the background, or on the first AI action, with a progress bar fed
  by `downloadAsset`/`loadModel` `onProgress`. A large first-run download never blocks
  normal journaling.
- Wire `suspend()` / `resume()` to React Native `AppState` (background → `suspend`,
  foreground → `resume`); read `state()` before AI actions.
- `cancel({ requestId })` any in-flight generation if the user leaves the result screen.
- `unloadModel()` / `close()` on app teardown.
- One model loaded at a time; `modelId` held in the service.

### AI actions (both are `completion()` calls, streamed)
- `diagnoseBrew(coffee, selectedBrew, recentBrews)` — recentBrews = last N≈8 brews of
  that coffee (most recent first). Prompt asks: given this coffee and these recent
  pour-over brews + the selected brew's tasting notes, how should I adjust my **next**
  brew? Return specific parameter changes (grind, ratio, water temp, agitation, pour /
  bloom) with a one-line reason each.
- `bestRecipe(coffee, allBrews)` — Prompt asks: from all these brews (params + tasting
  notes + ratings), determine the **best recipe** (dose, ratio, grind direction, temp,
  pour structure) and briefly justify it, referencing which past brews support it.

### Prompt construction
- System prompt: concise expert pour-over barista; constrained to filter coffee;
  actionable, specific, no rambling; output a short list of adjustments.
- Brews injected as a **compact table** (one row per brew, only populated fields) to fit
  `ctx_size` 4096. Cap at N≈8 brews for diagnose; for best-recipe, include all but cap
  total tokens (summarise/trim oldest if needed).
- Pure prompt-builder functions (no SDK calls) so they're unit-testable.

## 9. Error handling

- Model download/load failure → inline error with a **Retry**.
- AI buttons disabled with a hint ("Log a brew first") until the coffee has ≥1 brew.
- Generation cancelled (`stopReason: "cancelled"`) handled cleanly — no error toast.
- `LIFECYCLE_OPERATION_BLOCKED` (AI tapped while suspended) → re-resume then retry.
- Emulator/simulator unsupported → documented in README; app may show a notice if it
  detects an emulator via `expo-device`.

## 10. Testing strategy

QVAC requires a physical device and cannot run in CI/emulators, so the test split is:

- **Jest unit tests (TDD) for pure logic:**
  - SQLite data-access layer (CRUD, cascade, "brews for coffee", avg rating) — against
    an in-memory/temp SQLite where feasible, else a thin repository abstraction tested
    with a fake.
  - `ratio` computation and field formatting.
  - Prompt-builder functions (table formatting, N-cap, field omission) — assert on the
    constructed prompt string.
- **Manual on-device verification** (physical S23) for: model download/load/progress,
  streaming output, suspend/resume on background, cancel-on-leave, end-to-end Diagnose
  and Best recipe. A short manual test checklist will live in the repo.

## 11. Build order (high level — detailed plan comes next)

1. QVAC install + `expo prebuild` + smoke test on the S23 (de-risk the hardest part
   first: a streaming completion running on the device).
2. SQLite data layer + models (TDD).
3. Navigation + Coffees list / Coffee form / Coffee detail / Brew form (CRUD UI).
4. `qvac` service: lazy load, lifecycle, suspend/resume, cancel.
5. Prompt builders (TDD) + Diagnose + Best recipe wired to the Advisor result screen.
6. Polish: status indicator, empty states, error/retry, README + manual checklist.

## 12. Open items (acceptable to resolve during implementation)

- Exact `N` for recent-brew cap (start at 8, tune on-device).
- Whether to show or hide Qwen3 thinking by default (start: collapsible, hidden).
- Grinder field is free-text in MVP (no per-grinder calibration).
