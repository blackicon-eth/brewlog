import {
  AI_MODELS, DEFAULT_MODEL_ID, LOW_RAM_MODEL_ID,
  clampModelToDevice, defaultModelId, modelFits, resolveModel,
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

describe("modelFits (device fitness)", () => {
  it("rejects the 4B on an 8 GB device (known OOM) but accepts the 1.7B", () => {
    expect(modelFits(resolveModel("QWEN3_4B_INST_Q4_K_M"), 8 * GB)).toBe(false);
    expect(modelFits(resolveModel("QWEN3_1_7B_INST_Q4"), 8 * GB)).toBe(true);
  });

  it("rejects the 1.7B below its 4 GB floor, keeps the featherweight everywhere", () => {
    expect(modelFits(resolveModel("QWEN3_1_7B_INST_Q4"), 3 * GB)).toBe(false);
    expect(modelFits(resolveModel("QWEN3_600M_INST_Q4"), 2 * GB)).toBe(true);
  });

  it("never locks out a device with unknown memory", () => {
    for (const m of AI_MODELS) expect(modelFits(m, null)).toBe(true);
  });
});

describe("clampModelToDevice", () => {
  it("keeps a stored model that fits", () => {
    expect(clampModelToDevice("QWEN3_1_7B_INST_Q4", 8 * GB)).toBe("QWEN3_1_7B_INST_Q4");
  });

  it("clamps a too-big stored model to the device default", () => {
    expect(clampModelToDevice("QWEN3_4B_INST_Q4_K_M", 8 * GB)).toBe(DEFAULT_MODEL_ID);
    expect(clampModelToDevice("QWEN3_1_7B_INST_Q4", 3 * GB)).toBe(LOW_RAM_MODEL_ID);
  });

  it("resolves unknown ids before clamping", () => {
    expect(clampModelToDevice("SOME_REMOVED_MODEL", 3 * GB)).toBe(LOW_RAM_MODEL_ID);
    expect(clampModelToDevice(null, 8 * GB)).toBe(DEFAULT_MODEL_ID);
  });
});
