import { QWEN3_1_7B_INST_Q4, VERBOSITY } from "@qvac/sdk";

// Qwen3 1.7B (~1.1 GB): fits the Galaxy S23's available RAM. The 4B model OOM-killed
// the app while loading onto the GPU (~2.5 GB pinned vs ~2.7 GB free). Swap to
// QWEN3_4B_INST_Q4_K_M here only on devices with more headroom.
export const MODEL = QWEN3_1_7B_INST_Q4;

export const MODEL_CONFIG = {
  device: "gpu" as const,
  ctx_size: 4096,
  verbosity: VERBOSITY.ERROR,
};
