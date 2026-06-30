import {
  completion, downloadAsset, loadModel, unloadModel, cancel, suspend, resume, state,
  type ModelProgressUpdate,
} from "@qvac/sdk";
import { MODEL, MODEL_CONFIG } from "./modelConfig";
import type { ChatMessage } from "./advisor";

export type LoadStatus = "idle" | "downloading" | "loading" | "ready" | "error";
export type StreamHandlers = { onContent: (t: string) => void; onThinking?: (t: string) => void };

let modelId: string | null = null;
let loadingPromise: Promise<void> | null = null;

export async function ensureModel(
  onProgress?: (pct: number, status: LoadStatus) => void
): Promise<void> {
  if (modelId) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      onProgress?.(0, "downloading");
      await downloadAsset({
        assetSrc: MODEL,
        onProgress: (p: ModelProgressUpdate) => onProgress?.(Math.round(p.percentage), "downloading"),
      });
      onProgress?.(0, "loading");
      modelId = await loadModel({
        modelSrc: MODEL,
        modelType: "llm",
        modelConfig: MODEL_CONFIG,
        onProgress: (p: ModelProgressUpdate) => onProgress?.(Math.round(p.percentage), "loading"),
      });
      onProgress?.(100, "ready");
    } catch (e) {
      onProgress?.(0, "error");
      loadingPromise = null; // allow retry
      throw e;
    }
  })();
  return loadingPromise;
}

export function streamAdvice(history: ChatMessage[], handlers: StreamHandlers) {
  if (!modelId) throw new Error("Model not loaded. Call ensureModel() first.");
  const run = completion({ modelId, history, stream: true, captureThinking: true });
  // `requestId` is a non-optional `string` on `CompletionRun` — accessible directly.
  const { requestId } = run;

  const done = (async () => {
    for await (const ev of run.events) {
      if (ev.type === "contentDelta") handlers.onContent(ev.text);
      else if (ev.type === "thinkingDelta") handlers.onThinking?.(ev.text);
    }
    const final = await run.final;
    return { stopReason: final.stopReason };
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

export async function shutdown(): Promise<void> {
  if (modelId) { await unloadModel({ modelId, clearStorage: false }).catch(() => {}); modelId = null; }
  loadingPromise = null;
}
