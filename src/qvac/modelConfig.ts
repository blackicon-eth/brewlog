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
