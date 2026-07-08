# AI Settings Wiring — Design

**Date:** 2026-07-08
**Status:** Approved for planning

## Goal

Make the Settings AI section real: the enable/disable toggle and model picker actually
control the on-device QVAC model. Add a first-run welcome modal, gate every AI entry
point when AI is off, support live model switching without an app reboot, and pick a
sensible default model per device.

## Decisions (agreed with user)

1. **First-run modal, "yes" → download immediately** with a progress bar inside the
   modal; dismissable (download continues in the background).
2. **Gating UX = prompt to enable, not hide** — except the NL intake in forms, which
   hides entirely.
3. **Live swap, no reboot.** Toggle off → unload. Model change → unload + delete old
   file; new model downloads lazily on next use.
4. **Default model via RAM floor:** `expo-device` `totalMemory` < ~4 GB → Qwen3 0.6B,
   otherwise Qwen3 1.7B. Never auto-pick 4B (OOM-killed an 8 GB S23).
5. **Model switch deletes the old download** (`clearStorage: true`) — at most one model
   on disk. Toggling AI off *keeps* the file so off/on costs nothing.

## Architecture

### 1. QvacProvider owns AI settings (single source of truth)

- Lift `settings:ai:enabled` and `settings:ai:model` out of SettingsScreen's local
  `usePersistedState` into `QvacProvider` (same storage keys — existing values carry
  over). Add `settings:ai:onboarded` (default `false`).
- Context value becomes:
  `{ aiEnabled, modelId, onboarded, setAiEnabled, setModel, completeOnboarding,
  status, progress, error, prepare, retry, runAdvice }`.
- **Behavior change:** `enabled` defaults to `false` (was `true`). AI only activates
  after explicit opt-in (welcome modal or Settings toggle).
- SettingsScreen becomes a consumer of the context instead of owning the state.

### 2. Model-parametric service

- `src/qvac/modelConfig.ts` becomes a registry: picker id (`"QWEN3_600M_INST_Q4"`,
  `"LLAMA_3_2_1B_INST_Q4_0"`, `"QWEN3_1_7B_INST_Q4"`, `"QWEN3_4B_INST_Q4_K_M"`) →
  `{ sdkModel, config }`. Unknown stored ids fall back to the default.
- `ensureModel(modelKey, onProgress)` takes the key instead of reading a static
  constant.
- New `switchModel(oldKey, newKey)`: unload current model with `clearStorage: true`
  (deletes the old file), reset internal state to idle. New model loads lazily on
  next `prepare()`.
- Toggle off → `shutdown()` (unload, **keep** file).
- **Implementation-time verification:** whether the SDK can delete a downloaded asset
  that is not currently loaded (switching while idle). If no such API exists, delete
  only what is deletable and surface the limitation — do not fake it with a reboot.

### 3. Gating — centralized in `prepare()`

`prepare()` no-ops when `aiEnabled === false`. This alone fixes the CoffeesScreen
focus warm-up. Per touchpoint:

| Touchpoint | AI off behavior |
|---|---|
| Chat tab (MainTabs) | Tab stays; full-page "coach is off" state with Enable button. Enabling starts download in place via existing status UI. |
| Diagnose brew (BrewDetail, brew rows) | Button stays; tap opens "Turn on the coach?" confirm. Enable → flips setting → proceeds to AdvisorResult (already renders download progress). |
| Best recipe (CoffeeDetail) | Same confirm-modal pattern as Diagnose. |
| NL intake (Coffee/Brew forms) | Rendered `null`; forms are manual-only. No prompt. |

### 4. First-run welcome modal

- Shown at app root (inside QvacProvider) when `onboarded === false`, checked
  synchronously on mount.
- Styled like the existing ModelPicker bottom sheet. Copy: what the coach does,
  "runs fully on your phone", download size.
- **Turn it on** → RAM check picks default model, sets enabled, starts download with
  in-modal progress + "you can close this — it'll keep going".
- **Maybe later** → enabled stays false.
- Either path sets `onboarded: true`; the modal never re-appears.

### 5. Default model heuristic

`defaultModelId(totalMemoryBytes)` in a pure lib module: `< 4 GB → QWEN3_600M`,
else `QWEN3_1_7B`. Caller feeds it `Device.totalMemory` from `expo-device` (already
installed). Verify the exact API against the Expo SDK 54 docs before coding
(AGENTS.md rule).

## Edge cases

- **Settings change during an active download/load:** best effort — record the
  desired state; when the in-flight operation settles, immediately unload/clear to
  match. No hard cancel required.
- **Welcome-modal download failure:** reuse existing error + retry affordance.
- **Toggle off while a chat stream is running:** cancel the stream (already
  supported), then unload.
- **Unknown stored model id** (e.g. after a registry change): fall back to default,
  as SettingsScreen already does.

## Testing

- Unit tests (jest, pure libs): `defaultModelId` heuristic; registry map covers all
  four picker ids and falls back on unknown ids.
- On-device (S23): first-run modal both paths; enable/disable from Settings and from
  each gated entry point; model switch → old file gone, new downloads on next use;
  toggle off/on → no re-download.
