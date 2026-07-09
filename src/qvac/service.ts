import {
  completion, downloadAsset, loadModel, unloadModel, cancel, suspend, resume, state,
  type ModelProgressUpdate,
} from "@qvac/sdk";
import { MODEL_CONFIG, sdkModelFor } from "./modelConfig";
import type { ChatMessage } from "./advisor";

export type LoadStatus = "idle" | "downloading" | "loading" | "ready" | "error";
export type StreamHandlers = { onContent: (t: string) => void; onThinking?: (t: string) => void };

let modelId: string | null = null;      // SDK handle for the resident model
let loadedKey: string | null = null;    // picker id the resident handle belongs to
const activeRequests = new Set<string>(); // in-flight completions, cancelled before unload

// Every ensure/release runs as one whole turn on this FIFO chain — turns never
// interleave, so each one sees exactly the resident state the previous turn left.
let chain: Promise<void> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => {}, () => {}); // the chain itself never rejects or stalls
  return run;
}

// The last-REQUESTED desired state, recorded synchronously at call time (not when the
// turn runs). A queued ensureModel whose key no longer matches was superseded — the
// assistant got disabled or switched away — before its turn came; it aborts instead of
// loading a model nobody wants anymore.
let wantKey: string | null = null;

export async function ensureModel(
  key: string,
  onProgress?: (pct: number, status: LoadStatus) => void
): Promise<void> {
  wantKey = key;
  return serialize(async () => {
    if (wantKey !== key) return; // superseded while queued — abort silently
    if (modelId && loadedKey === key) return; // already resident
    if (modelId) {
      // A different model is resident — a switch, so its download goes too.
      await unloadModel({ modelId, clearStorage: true }).catch(() => {});
      modelId = null;
      loadedKey = null;
    }
    const src = sdkModelFor(key);
    try {
      loadedKey = key;
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
      modelId = null; // allow retry
      loadedKey = null;
      onProgress?.(0, "error");
      throw e;
    }
  });
}

// Unload the resident model (if any). `deleteFile` also removes its download from disk —
// only possible while a model is resident: the SDK has no API to delete a not-loaded
// asset, so a release that runs while nothing is loaded leaves the old file behind
// (harmless — switching back to it becomes an instant load instead of a re-download).
// Runs on the same FIFO chain as ensureModel, so an in-flight load settles first and is
// torn down here rather than surviving the toggle.
export async function releaseModel(opts: { deleteFile: boolean }): Promise<void> {
  wantKey = null;
  return serialize(async () => {
    // Kill any streaming answer first (a chat mid-generation when the user toggles the
    // assistant off) so the unload doesn't race a live completion.
    for (const requestId of activeRequests) void cancel({ requestId }).catch(() => {});
    if (modelId) {
      await unloadModel({ modelId, clearStorage: opts.deleteFile }).catch(() => {});
    }
    modelId = null;
    loadedKey = null;
  });
}

export async function shutdown(): Promise<void> {
  await releaseModel({ deleteFile: false });
}

export function streamAdvice(history: ChatMessage[], handlers: StreamHandlers) {
  if (!modelId) throw new Error("Model not loaded. Call ensureModel() first.");
  const run = completion({ modelId, history, stream: true, captureThinking: true });
  // `requestId` is a non-optional `string` on `CompletionRun` — accessible directly.
  const { requestId } = run;
  activeRequests.add(requestId);

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

  const doCancel = () => { void cancel({ requestId }).catch(() => {}); };
  return { done, cancel: doCancel };
}

export async function onAppBackground(): Promise<void> {
  if ((await state()) === "active") await suspend();
}
export async function onAppForeground(): Promise<void> {
  if ((await state()) === "suspended") await resume();
}
