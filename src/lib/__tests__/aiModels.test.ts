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
