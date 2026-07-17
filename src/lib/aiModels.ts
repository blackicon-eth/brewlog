// The assistant's model shelf: display metadata for every model the picker offers, plus the
// pure decisions built on it (fallback for stale stored ids, RAM-floor default, device
// fitness). Ids are the @qvac/sdk constant names on purpose — src/qvac/modelConfig.ts maps
// them to the real SDK assets. No SDK import here so this stays unit-testable under jest.

export type AiModel = {
  id: string;
  name: string;
  size: string;
  // Minimum device RAM this model is trusted on. The GPU pins the whole weight file plus
  // context, and the OS + app need their share: the 4B (2.5 GB) OOM-killed an 8 GB Galaxy
  // S23, the 1.7B (1.1 GB) runs comfortably there. These floors are deliberately cautious.
  minRamBytes: number;
};

const GB = 1024 * 1024 * 1024;

// Display note per model (locale-independent English fallback and dictionary key) lives in
// src/lib/i18n/{en,it}.ts under `aiModels`, resolved via `aiModelNote(dict, id)` in labels.ts
// — name/size stay here as proper nouns and units.
export const AI_MODELS: AiModel[] = [
  { id: "QWEN3_600M_INST_Q4", name: "Qwen3 0.6B", size: "0.4 GB", minRamBytes: 0 },
  { id: "LLAMA_3_2_1B_INST_Q4_0", name: "Llama 3.2 1B", size: "0.8 GB", minRamBytes: 3 * GB },
  { id: "QWEN3_1_7B_INST_Q4", name: "Qwen3 1.7B", size: "1.1 GB", minRamBytes: 4 * GB },
  { id: "QWEN3_4B_INST_Q4_K_M", name: "Qwen3 4B", size: "2.5 GB", minRamBytes: 12 * GB },
];

export const DEFAULT_MODEL_ID = "QWEN3_1_7B_INST_Q4";
export const LOW_RAM_MODEL_ID = "QWEN3_600M_INST_Q4";

// A stored id that no longer exists in the shelf falls back to the default entry.
export function resolveModel(id: string | null | undefined): AiModel {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
}

// Whether a model is trusted on a device with this much total RAM. Unknown memory
// (expo-device returns null on some platforms) never locks anyone out — the picker and
// clamp only restrict when the device has told us it's small.
export function modelFits(model: AiModel, totalMemoryBytes: number | null): boolean {
  return totalMemoryBytes == null || totalMemoryBytes >= model.minRamBytes;
}

// First-enable default: featherweight on low-RAM devices, the sweet spot otherwise.
export function defaultModelId(totalMemoryBytes: number | null): string {
  return modelFits(resolveModel(DEFAULT_MODEL_ID), totalMemoryBytes) ? DEFAULT_MODEL_ID : LOW_RAM_MODEL_ID;
}

// The id actually handed to the loader: whatever is stored, unless it doesn't fit the
// device — then the device's own default. Guards every enable path (Settings toggle, chat
// off-state, advisor gates), not just the onboarding sheet's suggestion.
export function clampModelToDevice(id: string | null | undefined, totalMemoryBytes: number | null): string {
  const model = resolveModel(id);
  return modelFits(model, totalMemoryBytes) ? model.id : defaultModelId(totalMemoryBytes);
}
