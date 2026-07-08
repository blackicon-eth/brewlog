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
