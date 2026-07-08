# AI Settings Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Settings AI toggle and model picker actually control the on-device QVAC model, add a first-run welcome sheet, gate every AI entry point when AI is off, and support live model switching without an app reboot.

**Architecture:** `QvacProvider` becomes the single owner of the persisted AI settings (`enabled`, `model`, `onboarded`) and gates `prepare()` centrally. The service layer becomes model-parametric (`ensureModel(key)` / `releaseModel({deleteFile})`). Entry points gate via a shared `useAdvisorGate()` confirm hook; the Chat tab renders an off-state; a one-time onboarding bottom sheet lives at the app root.

**Tech Stack:** Expo SDK 54 / React Native (Fabric), `@qvac/sdk` 0.13.5, `expo-sqlite/kv-store` (via existing `usePersistedState`), `expo-device` (already installed), jest for pure libs.

**Spec:** `docs/superpowers/specs/2026-07-08-ai-settings-wiring-design.md`

## Global Constraints

- **No new dependencies.** Everything needed is installed (`expo-device`, `@qvac/sdk`).
- **Motion tokens only:** every animation duration/spring comes from `motion` in `src/design/tokens.ts` (fast 120, quick 160, standard 200, gentle 450; springs `springGlide`/`springPop`/`springSnap`). Never hardcode.
- **Fabric flicker doctrine:** surfaces that restyle or fade use hairline borders (`borderWidth: 1, borderColor: colors.outlineVariant`), never elevation/shadows. Color/layout fades in re-render-heavy trees use `useNativeDriver: false`; transform/opacity-only animations in stable trees may use the native driver.
- **Storage keys are stable and namespaced:** `settings:ai:enabled`, `settings:ai:model`, `settings:ai:onboarded`. The first two already exist on devices — do not rename.
- **`settings:ai:enabled` default flips `true` → `false`** (opt-in via onboarding or Settings). This is intentional per spec.
- **SDK constraint (verified in `@qvac/sdk` 0.13.5 source):** `unloadModel({clearStorage: true})` deletes the model file but throws `ModelNotLoadedError` if the model is not loaded. There is NO API to delete a downloaded-but-not-loaded asset (`deleteCache` is KV-cache only). Deletion is therefore best-effort: full delete when a model is resident, orphaned file when switching while idle (acceptable — makes switch-back instant).
- **`expo-device`:** `totalMemory` is `number | null` (verified in installed SDK 54 package typings).
- Copy style: the app calls the AI "the coach" / "the advisor"; never "this phone" in model notes.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Typecheck command: `npx tsc --noEmit`. Test command: `npx jest`.

---

### Task 1: Pure model registry + RAM-floor heuristic (`src/lib/aiModels.ts`)

**Files:**
- Create: `src/lib/aiModels.ts`
- Test: `src/lib/__tests__/aiModels.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no SDK import — keeps it jest-runnable).
- Produces:
  - `type AiModel = { id: string; name: string; size: string; note: string }`
  - `AI_MODELS: AiModel[]` (4 entries, ids match `@qvac/sdk` constant names)
  - `DEFAULT_MODEL_ID: string` (`"QWEN3_1_7B_INST_Q4"`)
  - `LOW_RAM_MODEL_ID: string` (`"QWEN3_600M_INST_Q4"`)
  - `resolveModel(id: string | null | undefined): AiModel` (unknown/absent → default entry)
  - `defaultModelId(totalMemoryBytes: number | null): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/aiModels.test.ts
import {
  AI_MODELS, DEFAULT_MODEL_ID, LOW_RAM_MODEL_ID, defaultModelId, resolveModel,
} from "../aiModels";

const GB = 1024 * 1024 * 1024;

describe("aiModels registry", () => {
  it("contains the default and low-RAM ids", () => {
    const ids = AI_MODELS.map((m) => m.id);
    expect(ids).toContain(DEFAULT_MODEL_ID);
    expect(ids).toContain(LOW_RAM_MODEL_ID);
    expect(AI_MODELS).toHaveLength(4);
  });

  it("resolveModel returns the matching entry for a known id", () => {
    expect(resolveModel("QWEN3_600M_INST_Q4").id).toBe("QWEN3_600M_INST_Q4");
  });

  it("resolveModel falls back to the default for unknown or missing ids", () => {
    expect(resolveModel("SOME_REMOVED_MODEL").id).toBe(DEFAULT_MODEL_ID);
    expect(resolveModel(null).id).toBe(DEFAULT_MODEL_ID);
    expect(resolveModel(undefined).id).toBe(DEFAULT_MODEL_ID);
  });
});

describe("defaultModelId (RAM floor)", () => {
  it("picks the featherweight below 4 GB", () => {
    expect(defaultModelId(3 * GB)).toBe(LOW_RAM_MODEL_ID);
    expect(defaultModelId(3.9 * GB)).toBe(LOW_RAM_MODEL_ID);
  });

  it("picks the default at or above 4 GB", () => {
    expect(defaultModelId(4 * GB)).toBe(DEFAULT_MODEL_ID);
    expect(defaultModelId(8 * GB)).toBe(DEFAULT_MODEL_ID);
  });

  it("picks the default when memory is unknown", () => {
    expect(defaultModelId(null)).toBe(DEFAULT_MODEL_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/aiModels.test.ts`
Expected: FAIL — cannot find module `../aiModels`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/aiModels.ts
// The coach's model shelf: display metadata for every model the picker offers, plus the
// pure decisions built on it (fallback for stale stored ids, RAM-floor default). Ids are
// the @qvac/sdk constant names on purpose — src/qvac/modelConfig.ts maps them to the real
// SDK assets. No SDK import here so this stays unit-testable under jest.

export type AiModel = { id: string; name: string; size: string; note: string };

export const AI_MODELS: AiModel[] = [
  { id: "QWEN3_600M_INST_Q4", name: "Qwen3 0.6B", size: "0.4 GB", note: "Featherweight — instant, simple advice" },
  { id: "LLAMA_3_2_1B_INST_Q4_0", name: "Llama 3.2 1B", size: "0.8 GB", note: "Meta's pocket model — quick and chatty" },
  { id: "QWEN3_1_7B_INST_Q4", name: "Qwen3 1.7B", size: "1.1 GB", note: "Balanced — the everyday sweet spot" },
  { id: "QWEN3_4B_INST_Q4_K_M", name: "Qwen3 4B", size: "2.5 GB", note: "Deepest reasoning — too heavy for most phones" },
];

export const DEFAULT_MODEL_ID = "QWEN3_1_7B_INST_Q4";
export const LOW_RAM_MODEL_ID = "QWEN3_600M_INST_Q4";

// Below this much total RAM, even the 1.7B leaves too little headroom once the OS and the
// app have theirs (the 4B OOM-killed an 8 GB Galaxy S23 — never auto-pick it).
const LOW_RAM_FLOOR_BYTES = 4 * 1024 * 1024 * 1024;

// A stored id that no longer exists in the shelf falls back to the default entry.
export function resolveModel(id: string | null | undefined): AiModel {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
}

// First-enable default: featherweight on low-RAM devices, the sweet spot otherwise.
// Unknown memory (expo-device returns null on some platforms) gets the default.
export function defaultModelId(totalMemoryBytes: number | null): string {
  if (totalMemoryBytes != null && totalMemoryBytes < LOW_RAM_FLOOR_BYTES) return LOW_RAM_MODEL_ID;
  return DEFAULT_MODEL_ID;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/aiModels.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/aiModels.ts src/lib/__tests__/aiModels.test.ts
git commit -m "feat(ai): model shelf registry with RAM-floor default heuristic

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Model-parametric QVAC service

**Files:**
- Modify: `src/qvac/modelConfig.ts` (full rewrite, 13 lines today)
- Modify: `src/qvac/service.ts` (rewrite `ensureModel`, add `releaseModel`, repoint `shutdown`)

**Interfaces:**
- Consumes: `DEFAULT_MODEL_ID` from Task 1's `src/lib/aiModels.ts`.
- Produces:
  - `modelConfig.ts`: `MODEL_CONFIG` (unchanged shape), `sdkModelFor(id: string)` returning the SDK asset for a picker id (unknown → default's asset). The old `MODEL` export is deleted.
  - `service.ts`: `ensureModel(key: string, onProgress?: (pct: number, status: LoadStatus) => void): Promise<void>`, `releaseModel(opts: { deleteFile: boolean }): Promise<void>`, `shutdown(): Promise<void>` (now delegates to `releaseModel({deleteFile: false})`). `streamAdvice`, `onAppBackground`, `onAppForeground`, `LoadStatus`, `StreamHandlers` unchanged.

- [ ] **Step 1: Rewrite `src/qvac/modelConfig.ts`**

```ts
import {
  QWEN3_600M_INST_Q4,
  LLAMA_3_2_1B_INST_Q4_0,
  QWEN3_1_7B_INST_Q4,
  QWEN3_4B_INST_Q4_K_M,
  VERBOSITY,
} from "@qvac/sdk";
import { DEFAULT_MODEL_ID } from "../lib/aiModels";

// One shared runtime config for every model on the shelf. Qwen3 1.7B (~1.1 GB) fits the
// Galaxy S23's available RAM; the 4B OOM-killed the app while loading onto the GPU
// (~2.5 GB pinned vs ~2.7 GB free) — it stays offered, never auto-picked.
export const MODEL_CONFIG = {
  device: "gpu" as const,
  ctx_size: 4096,
  verbosity: VERBOSITY.ERROR,
};

// Picker id → SDK asset. The ids in src/lib/aiModels.ts are these constant names on
// purpose; that file stays SDK-free so it can run under jest.
const SDK_MODELS = {
  QWEN3_600M_INST_Q4,
  LLAMA_3_2_1B_INST_Q4_0,
  QWEN3_1_7B_INST_Q4,
  QWEN3_4B_INST_Q4_K_M,
};

type SdkModel = (typeof SDK_MODELS)[keyof typeof SDK_MODELS];

export function sdkModelFor(id: string): SdkModel {
  const table = SDK_MODELS as Record<string, SdkModel | undefined>;
  return table[id] ?? table[DEFAULT_MODEL_ID]!;
}
```

- [ ] **Step 2: Rewrite `src/qvac/service.ts`**

Keep the imports, `LoadStatus`, `StreamHandlers`, `streamAdvice`, `onAppBackground`, `onAppForeground` exactly as they are (change only the `MODEL, MODEL_CONFIG` import line). Replace the module state, `ensureModel`, and `shutdown`:

```ts
import {
  completion, downloadAsset, loadModel, unloadModel, cancel, suspend, resume, state,
  type ModelProgressUpdate,
} from "@qvac/sdk";
import { MODEL_CONFIG, sdkModelFor } from "./modelConfig";
import type { ChatMessage } from "./advisor";

export type LoadStatus = "idle" | "downloading" | "loading" | "ready" | "error";
export type StreamHandlers = { onContent: (t: string) => void; onThinking?: (t: string) => void };

let modelId: string | null = null;      // SDK handle for the resident model
let loadedKey: string | null = null;    // picker id the handle (or in-flight load) belongs to
let loadingPromise: Promise<void> | null = null;
let releasing: Promise<void> | null = null;
const activeRequests = new Set<string>(); // in-flight completions, cancelled before unload

export async function ensureModel(
  key: string,
  onProgress?: (pct: number, status: LoadStatus) => void
): Promise<void> {
  if (releasing) await releasing.catch(() => {});
  if (modelId && loadedKey === key) return;
  if (loadingPromise && loadedKey === key) return loadingPromise;
  // A different model is resident from before a settings change settled — clear it out
  // (deleteFile: it was switched away from, so its download goes too).
  if (modelId || loadingPromise) await releaseModel({ deleteFile: true });

  loadedKey = key;
  const src = sdkModelFor(key);
  loadingPromise = (async () => {
    try {
      onProgress?.(0, "downloading");
      await downloadAsset({
        assetSrc: src,
        onProgress: (p: ModelProgressUpdate) => onProgress?.(Math.round(p.percentage), "downloading"),
      });
      onProgress?.(0, "loading");
      modelId = await loadModel({
        modelSrc: src,
        modelType: "llm",
        modelConfig: MODEL_CONFIG,
        onProgress: (p: ModelProgressUpdate) => onProgress?.(Math.round(p.percentage), "loading"),
      });
      onProgress?.(100, "ready");
    } catch (e) {
      onProgress?.(0, "error");
      loadingPromise = null; // allow retry
      loadedKey = null;
      throw e;
    }
  })();
  return loadingPromise;
}

// Unload the resident model (if any). `deleteFile` also removes its download from disk —
// only possible while a model is resident: the SDK has no API to delete a not-loaded
// asset, so a switch that happens while nothing is loaded leaves the old file behind
// (harmless — switching back to it becomes an instant load instead of a re-download).
// Waits out an in-flight load first so settings changes mid-download settle correctly.
export async function releaseModel(opts: { deleteFile: boolean }): Promise<void> {
  const run = (async () => {
    // Kill any streaming answer first (a chat mid-generation when the user toggles the
    // coach off) so the unload doesn't race a live completion.
    for (const requestId of activeRequests) void cancel({ requestId }).catch(() => {});
    if (loadingPromise) await loadingPromise.catch(() => {});
    if (modelId) {
      await unloadModel({ modelId, clearStorage: opts.deleteFile }).catch(() => {});
    }
    modelId = null;
    loadedKey = null;
    loadingPromise = null;
  })();
  releasing = run;
  try {
    await run;
  } finally {
    if (releasing === run) releasing = null;
  }
}

export async function shutdown(): Promise<void> {
  await releaseModel({ deleteFile: false });
}
```

And in the existing `streamAdvice` (otherwise unchanged), register the run so `releaseModel` can cancel it — add after `const { requestId } = run;`:

```ts
  activeRequests.add(requestId);
```

and wrap the `done` async body's ending so the id always clears:

```ts
  const done = (async () => {
    try {
      for await (const ev of run.events) {
        if (ev.type === "contentDelta") handlers.onContent(ev.text);
        else if (ev.type === "thinkingDelta") handlers.onThinking?.(ev.text);
      }
      const final = await run.final;
      return { stopReason: final.stopReason };
    } finally {
      activeRequests.delete(requestId);
    }
  })();
```

(`onAppBackground`, `onAppForeground` stay byte-identical below these.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exactly one class of error — `QvacProvider.tsx` still calls `ensureModel` with the old single-callback signature. That is Task 3's file. If `modelConfig.ts` or `service.ts` themselves error, fix them now (the `SdkModel` cast may need adjusting until clean).

- [ ] **Step 4: Commit**

```bash
git add src/qvac/modelConfig.ts src/qvac/service.ts
git commit -m "feat(ai): model-parametric service with best-effort file cleanup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Committing with the known provider error is fine — Task 3 lands minutes later; alternatively squash Tasks 2–3 locally if you prefer a green tree per commit: then hold this commit and do one combined commit at the end of Task 3.)

---

### Task 3: QvacProvider owns the AI settings; SettingsScreen consumes them

**Files:**
- Modify: `src/qvac/QvacProvider.tsx` (full rewrite, 67 lines today)
- Modify: `src/screens/SettingsScreen.tsx:1-36` (imports + state block), `:62` (toggle), `:109-117` (picker handlers) — the `MODELS`/`DEFAULT_MODEL_ID` definitions move out
- Modify: `src/components/ui/StatusPill.tsx` (off label)

**Interfaces:**
- Consumes: `ensureModel(key, cb)` / `releaseModel({deleteFile})` from Task 2; `DEFAULT_MODEL_ID`, `resolveModel`, `AI_MODELS`, `AiModel` from Task 1; existing `usePersistedState`.
- Produces (context shape every later task relies on):

```ts
type QvacContextValue = {
  status: LoadStatus;
  progress: number;
  error: string | null;
  aiEnabled: boolean;
  modelId: string;                       // picker id, always a known one via resolveModel
  onboarded: boolean;
  setAiEnabled: (v: boolean) => void;    // false → unload, keep file
  setModel: (id: string) => void;        // switch → unload + delete old file, lazy reload
  completeOnboarding: () => void;
  prepare: () => void;                   // no-op while aiEnabled === false
  retry: () => void;
  runAdvice: (h: ChatMessage[], handlers: StreamHandlers) => { done: Promise<{ stopReason?: string }>; cancel: () => void };
};
```

- [ ] **Step 1: Rewrite `src/qvac/QvacProvider.tsx`**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  ensureModel, releaseModel, streamAdvice, onAppBackground, onAppForeground, shutdown,
  type LoadStatus, type StreamHandlers,
} from "./service";
import { usePersistedState } from "../hooks/usePersistedState";
import { DEFAULT_MODEL_ID, resolveModel } from "../lib/aiModels";
import type { ChatMessage } from "./advisor";

type QvacContextValue = {
  status: LoadStatus;
  progress: number;
  error: string | null;
  aiEnabled: boolean;
  modelId: string;
  onboarded: boolean;
  setAiEnabled: (v: boolean) => void;
  setModel: (id: string) => void;
  completeOnboarding: () => void;
  prepare: () => void;
  retry: () => void;
  runAdvice: (h: ChatMessage[], handlers: StreamHandlers) => { done: Promise<{ stopReason?: string }>; cancel: () => void };
};

const QvacContext = createContext<QvacContextValue | null>(null);

export function QvacProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // The AI settings live here — the single owner. Settings/Chat/gates all read and write
  // through this context. Enabled defaults to FALSE: the coach is opt-in (onboarding
  // sheet or the Settings switch).
  const [aiEnabled, setAiEnabledState] = usePersistedState("settings:ai:enabled", false);
  const [modelIdRaw, setModelIdState] = usePersistedState("settings:ai:model", DEFAULT_MODEL_ID);
  const [onboarded, setOnboarded] = usePersistedState("settings:ai:onboarded", false);
  const modelId = resolveModel(modelIdRaw).id;

  // Mirrors written synchronously in the setters (NOT via useEffect): callers flip a
  // setting and call prepare() in the same tick, so prepare must see the new value
  // before React re-renders. This also keeps prepare referentially stable — screens
  // hang mount effects off it.
  const aiEnabledRef = useRef(aiEnabled);
  const modelIdRef = useRef(modelId);

  const prepare = useCallback(() => {
    if (!aiEnabledRef.current) return;      // AI off: never download or load anything
    if (started.current) return;            // already loading or loaded
    started.current = true;
    setError(null);
    ensureModel(modelIdRef.current, (pct, s) => { setProgress(pct); setStatus(s); }).catch((e) => {
      setError(e?.message ?? String(e));
      setStatus("error");
      // Intentionally leave started.current = true: do NOT auto-retry on
      // status-driven re-renders. Retry is user-initiated via retry().
    });
  }, []);

  const retry = useCallback(() => {
    started.current = false;
    prepare();
  }, [prepare]);

  const resetToIdle = useCallback(() => {
    started.current = false;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  const setAiEnabled = useCallback((v: boolean) => {
    aiEnabledRef.current = v;
    setAiEnabledState(v);
    if (!v) {
      resetToIdle();
      // Free the RAM but keep the download — flipping the coach back on costs nothing.
      void releaseModel({ deleteFile: false });
    }
  }, [setAiEnabledState, resetToIdle]);

  const setModel = useCallback((id: string) => {
    if (id === modelIdRef.current) return;
    modelIdRef.current = id;
    setModelIdState(id);
    resetToIdle();
    // The switched-away model goes entirely — file included (best effort; see service).
    // The new one downloads lazily when the coach next starts.
    void releaseModel({ deleteFile: true });
  }, [setModelIdState, resetToIdle]);

  const completeOnboarding = useCallback(() => setOnboarded(true), [setOnboarded]);

  const runAdvice = useCallback((h: ChatMessage[], handlers: StreamHandlers) => {
    return streamAdvice(h, handlers);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") void onAppBackground();
      else if (next === "active") void onAppForeground();
    });
    return () => { sub.remove(); void shutdown(); };
  }, []);

  return (
    <QvacContext.Provider
      value={{
        status, progress, error,
        aiEnabled, modelId, onboarded,
        setAiEnabled, setModel, completeOnboarding,
        prepare, retry, runAdvice,
      }}
    >
      {children}
    </QvacContext.Provider>
  );
}

export function useQvac(): QvacContextValue {
  const ctx = useContext(QvacContext);
  if (!ctx) throw new Error("useQvac must be used within QvacProvider");
  return ctx;
}
```

- [ ] **Step 2: Point SettingsScreen at the context**

In `src/screens/SettingsScreen.tsx`:

1. Delete the local `type ModelChoice`, `const MODELS`, `const DEFAULT_MODEL_ID` block (lines 9–22) and the `usePersistedState` import. Add:

```ts
import { useQvac } from "../qvac/QvacProvider";
import { AI_MODELS, resolveModel, type AiModel } from "../lib/aiModels";
```

2. Replace the state block (lines 31–36) with:

```ts
const { aiEnabled, setAiEnabled, modelId, setModel } = useQvac();
const [pickerOpen, setPickerOpen] = useState(false);

const selected = resolveModel(modelId);
```

3. The switch (line 62): `<LedgerSwitch value={aiEnabled} onToggle={() => setAiEnabled(!aiEnabled)} />`

4. The picker handlers (lines 109–117):

```tsx
<ModelPicker
  visible={pickerOpen}
  selectedId={selected.id}
  onSelect={(id) => {
    setModel(id);
    setPickerOpen(false);
  }}
  onClose={() => setPickerOpen(false)}
/>
```

5. Inside `ModelPicker` and `ModelRow`, replace `MODELS` with `AI_MODELS` and the `ModelChoice` type annotation with `AiModel`. Everything else (styles, LedgerSwitch, DataAction, footnote copy "The chosen model is downloaded when the advisor next starts.") stays as is — the footnote is now literally true.

- [ ] **Step 3: Teach StatusPill about off**

In `src/components/ui/StatusPill.tsx`, destructure `aiEnabled` too and make it the first label case:

```ts
const { status, progress, retry, aiEnabled } = useQvac();

const label =
  !aiEnabled ? "Advisor off" :
  status === "ready" ? "Advisor ready" :
  status === "downloading" ? `Downloading ${progress}%` :
  status === "loading" ? `Loading ${progress}%` :
  status === "error" ? "Advisor unavailable" : "Advisor idle";
const dot =
  aiEnabled && status === "ready" ? colors.primary :
  aiEnabled && status === "error" ? colors.tertiary : colors.outline;
```

And gate the retry affordance: `{aiEnabled && status === "error" ? (…Retry…) : null}`.

- [ ] **Step 4: Typecheck + existing tests**

Run: `npx tsc --noEmit` — Expected: clean (the Task 2 provider error is now gone).
Run: `npx jest` — Expected: all suites pass (nothing here touches the tested libs).

- [ ] **Step 5: Commit**

```bash
git add src/qvac/QvacProvider.tsx src/screens/SettingsScreen.tsx src/components/ui/StatusPill.tsx
git commit -m "feat(ai): QvacProvider owns AI settings; Settings toggle and picker go live

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Gate every AI entry point

**Files:**
- Create: `src/hooks/useAdvisorGate.ts`
- Modify: `src/screens/ChatScreen.tsx` (off-state page)
- Modify: `src/screens/BrewDetailScreen.tsx:159` (diagnose button)
- Modify: `src/screens/CoffeeDetailScreen.tsx:110,172` (best-recipe card + row diagnose)
- Modify: `src/components/ui/NaturalLanguageIntake.tsx` (render null when off)

**Interfaces:**
- Consumes: `useQvac()` context from Task 3 (`aiEnabled`, `setAiEnabled`, `prepare`); existing `useAppModal().confirm({title, message?, confirmLabel?}): Promise<boolean>` from `src/components/ui`.
- Produces: `useAdvisorGate(): (go: () => void) => Promise<void>` — runs `go` immediately when AI is on; otherwise confirm-prompts, enables, warms the model, then runs `go`.

- [ ] **Step 1: Create `src/hooks/useAdvisorGate.ts`**

```ts
import { useCallback } from "react";
import { useQvac } from "../qvac/QvacProvider";
import { useAppModal } from "../components/ui";

// Wraps an AI-powered action (diagnose, best recipe): runs it straight away when the
// coach is on; otherwise asks first, flips the setting, warms the model and then runs
// it — the destination screen already renders download progress, so the tap lands
// somewhere alive either way.
export function useAdvisorGate() {
  const { aiEnabled, setAiEnabled, prepare } = useQvac();
  const modal = useAppModal();

  return useCallback(
    async (go: () => void) => {
      if (aiEnabled) {
        go();
        return;
      }
      const yes = await modal.confirm({
        title: "Turn on the coach?",
        message: "This needs the on-device AI. It runs privately on your phone; the model downloads once.",
        confirmLabel: "Turn it on",
      });
      if (!yes) return;
      setAiEnabled(true);
      prepare();
      go();
    },
    [aiEnabled, setAiEnabled, prepare, modal],
  );
}
```

- [ ] **Step 2: Gate the three navigate call sites**

In `src/screens/BrewDetailScreen.tsx` — add imports and hook:

```ts
import { useAdvisorGate } from "../hooks/useAdvisorGate";
// inside the component:
const gate = useAdvisorGate();
```

Change the diagnose button (line 159):

```tsx
onPress={() => void gate(() => nav.navigate("AdvisorResult", { kind: "diagnose", coffeeId: params.coffeeId, brewId: params.brewId, title: "Diagnose brew" }))}
```

In `src/screens/CoffeeDetailScreen.tsx` — same import + `const gate = useAdvisorGate();`, then:

Line 110 (AiActionCard):

```tsx
onPress={() => void gate(() => nav.navigate("AdvisorResult", { kind: "bestRecipe", coffeeId: params.coffeeId, title: "Best recipe" }))}
```

Line 172 (row diagnose):

```tsx
onDiagnose={() => void gate(() => nav.navigate("AdvisorResult", { kind: "diagnose", coffeeId: params.coffeeId, brewId: item.id, title: "Diagnose brew" }))}
```

- [ ] **Step 3: Chat off-state**

In `src/screens/ChatScreen.tsx`:

1. Extend the context destructure (line 40): `const { status, prepare, retry, runAdvice, aiEnabled, setAiEnabled } = useQvac();`
2. Add `PillButton` to the ui import (line 10).
3. Immediately before the main `return` (line 157) — after every hook — insert:

```tsx
// The coach is off: the tab stays reachable (hiding it would reflow the whole bar and
// bury the feature), but the canvas explains itself and offers the switch right here.
if (!aiEnabled) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>Chat</AppText>
        <AppText variant="labelMd" style={styles.subtitle}>On-device brewing coach</AppText>
      </View>
      <View style={styles.offWrap}>
        <AppText style={styles.spark}>✦</AppText>
        <AppText variant="headlineMd" style={styles.emptyTitle}>The coach is off</AppText>
        <AppText variant="bodyMd" style={styles.emptyBody}>
          Turn on the on-device AI to chat about grind, ratio, water and technique.
          Everything runs privately on your phone — nothing you brew ever leaves it.
        </AppText>
        <PillButton
          label="Turn on the coach"
          variant="primary"
          style={styles.offBtn}
          onPress={() => { setAiEnabled(true); prepare(); }}
        />
      </View>
    </View>
  );
}
```

4. Add to styles:

```ts
offWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.container, paddingBottom: 80 },
offBtn: { marginTop: spacing.section },
```

(`spark`, `emptyTitle`, `emptyBody` styles already exist and are reused.)

Note: the existing mount effect calls `prepare()` unconditionally — that is now safely a no-op while off (Task 3), so it needs no change.

- [ ] **Step 4: Hide the NL intake when off**

In `src/components/ui/NaturalLanguageIntake.tsx`:

1. Line 24: `const { status, prepare, runAdvice, aiEnabled } = useQvac();`
2. Directly before the component's `return (` (after all hooks and handler definitions — around line 93):

```tsx
// Coach off: the box simply isn't there — the form works manually, and a prompt
// mid-form-filling would be an interruption, not an invitation.
if (!aiEnabled) return null;
```

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — Expected: clean.

```bash
git add src/hooks/useAdvisorGate.ts src/screens/ChatScreen.tsx src/screens/BrewDetailScreen.tsx src/screens/CoffeeDetailScreen.tsx src/components/ui/NaturalLanguageIntake.tsx
git commit -m "feat(ai): gate chat, diagnose, best-recipe and NL intake behind the AI switch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: First-run onboarding sheet

**Files:**
- Create: `src/components/AiOnboardingSheet.tsx`
- Modify: `App.tsx:39-44` (mount the sheet)

**Interfaces:**
- Consumes: `useQvac()` (`onboarded`, `aiEnabled`, `completeOnboarding`, `setAiEnabled`, `setModel`, `prepare`, `retry`, `status`, `progress`, `error`); `defaultModelId`, `resolveModel` from Task 1; `Device.totalMemory` from `expo-device`; `motion`/`colors`/`radii`/`spacing`/`fonts` tokens; `AppText`, `PillButton` from `src/components/ui`.
- Produces: `<AiOnboardingSheet />` — self-managing, rendered once at app root; shows only when `onboarded === false && aiEnabled === false`; marks onboarded on any resolution.

- [ ] **Step 1: Create `src/components/AiOnboardingSheet.tsx`**

```tsx
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import { AppText, PillButton, SparkGlyph } from "./ui";
import { useQvac } from "../qvac/QvacProvider";
import { defaultModelId, resolveModel } from "../lib/aiModels";
import { colors, fonts, motion, radii, spacing } from "../design/tokens";

// The welcome mat: shown exactly once, on the very first launch, asking whether to turn
// on the on-device coach. Saying yes starts the download right here — a progress bar in
// the sheet, dismissable, the work carries on behind it. Saying "maybe later" leaves the
// coach off; every gated entry point can still turn it on afterwards.
export function AiOnboardingSheet() {
  const insets = useSafeAreaInsets();
  const {
    onboarded, aiEnabled, completeOnboarding,
    setAiEnabled, setModel, prepare, retry,
    status, progress, error,
  } = useQvac();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ask" | "busy">("ask");

  // The device picks its own default: featherweight below the RAM floor, the sweet
  // spot otherwise. Resolved once — the sheet mounts once, at app start.
  const suggested = useRef(resolveModel(defaultModelId(Device.totalMemory))).current;

  // Decide once at mount. Users who already turned the coach on (in Settings, before
  // this sheet existed) are grandfathered in — marked onboarded, never welcomed twice.
  useEffect(() => {
    if (onboarded) return;
    if (aiEnabled) { completeOnboarding(); return; }
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setShown(true);
      Animated.timing(anim, { toValue: 1, duration: motion.standard, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(anim, { toValue: 0, duration: motion.fast, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setShown(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!shown) return null;

  const turnOn = () => {
    completeOnboarding();
    setModel(suggested.id);   // no-op when it's already the stored default
    setAiEnabled(true);
    prepare();
    setMode("busy");
  };

  const later = () => {
    completeOnboarding();
    setOpen(false);
  };

  const statusLine =
    status === "ready" ? "All set — the coach is ready." :
    status === "loading" ? `Loading ${progress}%` :
    status === "error" ? (error ?? "The download failed — check your connection.") :
    `Downloading ${progress}%`;

  return (
    <Modal transparent visible statusBarTranslucent onRequestClose={later}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]} />
      <View style={styles.host} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 20 },
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [440, 0] }) }] },
          ]}
        >
          <View style={styles.halo}>
            <SparkGlyph size={24} color={colors.primary} />
          </View>

          {mode === "ask" ? (
            <>
              <AppText variant="labelSm" style={styles.kicker}>On-device coach</AppText>
              <AppText variant="headlineMd" style={styles.title}>Meet your brewing coach</AppText>
              <AppText variant="bodyMd" style={styles.body}>
                Brewlog can diagnose brews, suggest recipes and chat about technique — with a
                model that runs entirely on your phone. Nothing you brew ever leaves it.
              </AppText>
              <View style={styles.modelNote}>
                <AppText variant="labelSm" style={styles.modelNoteLabel}>Suggested for this device</AppText>
                <AppText variant="bodyMd" style={styles.modelNoteValue}>
                  {suggested.name} · {suggested.size} one-time download
                </AppText>
              </View>
              <PillButton label="Turn it on" variant="primary" onPress={turnOn} />
              <Pressable accessibilityRole="button" onPress={later} style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}>
                <AppText variant="labelMd" style={styles.laterText}>Maybe later</AppText>
              </Pressable>
            </>
          ) : (
            <>
              <AppText variant="labelSm" style={styles.kicker}>On-device coach</AppText>
              <AppText variant="headlineMd" style={styles.title}>
                {status === "ready" ? "The coach is in" : "Brewing up the coach"}
              </AppText>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${status === "ready" ? 100 : progress}%` }]} />
              </View>
              <AppText variant="bodyMd" style={[styles.statusLine, status === "error" && styles.statusError]}>
                {statusLine}
              </AppText>
              {status === "error" ? (
                <PillButton label="Try again" variant="primary" onPress={retry} />
              ) : (
                <PillButton
                  label={status === "ready" ? "Done" : "Keep brewing — it'll finish itself"}
                  variant={status === "ready" ? "primary" : "neutral"}
                  onPress={() => setOpen(false)}
                />
              )}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,22,14,0.45)" },
  host: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.container,
    paddingTop: 24,
  },
  halo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: { color: colors.secondary },
  // EB Garamond descenders clip on Android — give headlineMd explicit room.
  title: { marginTop: 4, lineHeight: 34, includeFontPadding: false },
  body: { marginTop: 8, lineHeight: 22, color: colors.onSurfaceVariant },
  modelNote: {
    marginTop: 16,
    marginBottom: 18,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceLowest,
  },
  modelNoteLabel: { color: colors.secondary },
  modelNoteValue: { marginTop: 3, fontFamily: fonts.sansSemiBold, color: colors.onSurface },
  laterBtn: { alignSelf: "center", paddingVertical: 14, paddingHorizontal: 20 },
  laterText: { color: colors.secondary },
  pressed: { opacity: 0.7 },
  progressTrack: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
    marginTop: 18,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radii.full, backgroundColor: colors.primary },
  statusLine: { marginTop: 10, marginBottom: 18, color: colors.onSurfaceVariant },
  statusError: { color: colors.tertiary },
});
```

(`PillButton` variants are `"primary" | "danger" | "dangerSolid" | "neutral"` — verified in `src/components/ui/PillButton.tsx`. It renders full-width, which is what the sheet wants.)

- [ ] **Step 2: Mount at the app root**

In `App.tsx`, import and render the sheet as a sibling of `NavigationContainer` (inside both providers so it gets context + modal-free stacking):

```tsx
import { AiOnboardingSheet } from "./src/components/AiOnboardingSheet";
// …
<QvacProvider>
  <AppModalProvider>
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style="light" />
    </NavigationContainer>
    <AiOnboardingSheet />
  </AppModalProvider>
</QvacProvider>
```

- [ ] **Step 3: Typecheck and full test run**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npx jest` — Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/AiOnboardingSheet.tsx App.tsx
git commit -m "feat(ai): first-run onboarding sheet with in-sheet download progress

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: On-device verification (S23)

**Files:** none (verification only). Metro must be running; reload via `adb reverse tcp:8081 tcp:8081` then `adb shell am force-stop com.anonymous.brewlog && adb shell monkey -p com.anonymous.brewlog -c android.intent.category.LAUNCHER 1`.

- [ ] **Step 1: Reset to a virgin state on the device**

The dev phone already has `settings:ai:enabled: true` persisted, which grandfathers past the onboarding. To test the first-run path, clear app storage once: `adb shell pm clear com.anonymous.brewlog` (warning: wipes the brew ledger DB on the dev device — confirm with the user first, or test onboarding last).

- [ ] **Step 2: Walk the manual checklist with the user**

1. **First run:** onboarding sheet appears; "Suggested for this device" says Qwen3 1.7B (S23 = 8 GB).
2. **Maybe later:** sheet never returns on relaunch; Home StatusPill says "Advisor off"; Home visit downloads nothing (watch Metro logs — no download progress).
3. **Chat tab off-state** renders; "Turn on the coach" starts the download in place.
4. **Diagnose / Best recipe while off:** confirm modal appears; Cancel does nothing; "Turn it on" navigates and the advisor sheet shows download progress.
5. **NL intake** absent from Coffee/Brew forms while off, back when on.
6. **Onboarding "Turn it on"** (after another `pm clear`): progress bar advances in the sheet, dismiss mid-download, StatusPill keeps counting, chat works when ready.
7. **Toggle off in Settings while ready:** RAM drops (model unloads), pills go "Advisor off". Toggle back on + open chat: load only, no re-download (file was kept).
8. **Switch model while ready** (1.7B → 0.6B): next chat downloads 0.6B; switch back to 1.7B → downloads again (file was deleted on switch-away).
9. **Toggle off mid-stream in chat:** stream dies into an error bubble, no crash, no hang.

- [ ] **Step 3: Push**

Only when the user says so:

```bash
git push
```
