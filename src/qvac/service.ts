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
