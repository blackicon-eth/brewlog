// The service's toggle/switch state machine: every sequence here drives ensureModel /
// releaseModel the way QvacProvider does (release on toggle-off / switch, ensure on
// prepare) and asserts what the SDK actually saw — loads, unloads, downloads — plus
// what ends up resident.

jest.mock("@qvac/sdk", () => ({
  downloadAsset: jest.fn(),
  loadModel: jest.fn(),
  unloadModel: jest.fn(),
  cancel: jest.fn(),
  completion: jest.fn(),
  suspend: jest.fn(),
  resume: jest.fn(),
  state: jest.fn(),
  VERBOSITY: { ERROR: 0 },
  QWEN3_600M_INST_Q4: "asset-qwen3-600m",
  LLAMA_3_2_1B_INST_Q4_0: "asset-llama-1b",
  QWEN3_1_7B_INST_Q4: "asset-qwen3-1.7b",
  QWEN3_4B_INST_Q4_K_M: "asset-qwen3-4b",
}));

const KEY_A = "QWEN3_1_7B_INST_Q4";
const KEY_B = "QWEN3_600M_INST_Q4";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Let queued microtasks run so an ensureModel turn actually starts (and its download is
// genuinely in flight) before the test fires the next toggle.
const flush = () => new Promise<void>((r) => setImmediate(r));

type Service = typeof import("../service");
let service: Service;
let sdk: {
  downloadAsset: jest.Mock;
  loadModel: jest.Mock;
  unloadModel: jest.Mock;
  cancel: jest.Mock;
  completion: jest.Mock;
};

// Module state (resident model, FIFO chain, wantKey) lives at module level — reset the
// registry so every test starts from a factory-fresh service and freshly minted mocks.
beforeEach(() => {
  jest.resetModules();
  sdk = require("@qvac/sdk");
  service = require("../service");
  sdk.loadModel.mockResolvedValue("model-handle");
  sdk.unloadModel.mockResolvedValue(undefined);
  sdk.cancel.mockResolvedValue(undefined);
});

// Residency probe: streamAdvice throws iff no model is resident.
function resident(): boolean {
  sdk.completion.mockReturnValue({
    requestId: "req-1",
    events: (async function* () {})(),
    final: Promise.resolve({ stopReason: "stop" }),
  });
  try {
    service.streamAdvice([], { onContent: () => {} });
    return true;
  } catch {
    return false;
  }
}

it("happy path: downloads, loads, reports progress in order, ends resident", async () => {
  sdk.downloadAsset.mockResolvedValue(undefined);
  const statuses: string[] = [];
  await service.ensureModel(KEY_A, (_pct, s) => statuses.push(s));
  expect(statuses[0]).toBe("downloading");
  expect(statuses).toContain("loading");
  expect(statuses[statuses.length - 1]).toBe("ready");
  expect(sdk.downloadAsset).toHaveBeenCalledTimes(1);
  expect(sdk.loadModel).toHaveBeenCalledTimes(1);
  expect(resident()).toBe(true);
});

it("re-ensuring the resident key is a no-op", async () => {
  sdk.downloadAsset.mockResolvedValue(undefined);
  await service.ensureModel(KEY_A);
  await service.ensureModel(KEY_A);
  expect(sdk.downloadAsset).toHaveBeenCalledTimes(1);
  expect(sdk.loadModel).toHaveBeenCalledTimes(1);
});

it("triple-toggle race: exactly one load, one unload, no second download, nothing resident", async () => {
  const dl = deferred<void>();
  sdk.downloadAsset.mockReturnValue(dl.promise);

  const e1 = service.ensureModel(KEY_A);                  // (a) download in flight
  await flush();
  const r1 = service.releaseModel({ deleteFile: false }); // (b) toggle off
  const e2 = service.ensureModel(KEY_A);                  // (c) toggle on again
  const r2 = service.releaseModel({ deleteFile: false }); // (d) toggle off again

  dl.resolve(); // the download finally settles
  await Promise.all([e1, r1, e2, r2]);

  // E1 completes its load, R1 tears it down, E2 aborts (wantKey is null), R2 no-ops.
  expect(sdk.downloadAsset).toHaveBeenCalledTimes(1);
  expect(sdk.loadModel).toHaveBeenCalledTimes(1);
  expect(sdk.unloadModel).toHaveBeenCalledTimes(1);
  expect(resident()).toBe(false);
});

it("toggle off mid-download: load settles, then it's unloaded, nothing resident", async () => {
  const dl = deferred<void>();
  sdk.downloadAsset.mockReturnValue(dl.promise);

  const e1 = service.ensureModel(KEY_A);
  await flush();
  const r1 = service.releaseModel({ deleteFile: false });
  dl.resolve();
  await Promise.all([e1, r1]);

  expect(sdk.unloadModel).toHaveBeenCalledWith({ modelId: "model-handle", clearStorage: false });
  expect(resident()).toBe(false);
});

it("off then on quickly mid-download: old unloaded (file kept), then reloaded", async () => {
  const dl = deferred<void>();
  sdk.downloadAsset.mockReturnValueOnce(dl.promise).mockResolvedValue(undefined);

  const e1 = service.ensureModel(KEY_A);
  await flush();
  const r1 = service.releaseModel({ deleteFile: false }); // toggle off
  const e2 = service.ensureModel(KEY_A);                  // toggle back on + prepare
  dl.resolve();
  await Promise.all([e1, r1, e2]);

  expect(sdk.unloadModel).toHaveBeenCalledTimes(1);
  expect(sdk.unloadModel).toHaveBeenCalledWith({ modelId: "model-handle", clearStorage: false });
  // E2 still wants KEY_A, so it runs again — file kept on disk makes this a fast load.
  expect(sdk.loadModel).toHaveBeenCalledTimes(2);
  expect(resident()).toBe(true);
});

it("switch model mid-download: old deleted with clearStorage true, new one loads", async () => {
  const dl = deferred<void>();
  sdk.downloadAsset.mockReturnValueOnce(dl.promise).mockResolvedValue(undefined);

  const e1 = service.ensureModel(KEY_A);
  await flush();
  const r1 = service.releaseModel({ deleteFile: true }); // setModel(B) releases the old one
  const e2 = service.ensureModel(KEY_B);
  dl.resolve();
  await Promise.all([e1, r1, e2]);

  expect(sdk.unloadModel).toHaveBeenCalledTimes(1);
  expect(sdk.unloadModel).toHaveBeenCalledWith({ modelId: "model-handle", clearStorage: true });
  expect(sdk.downloadAsset).toHaveBeenNthCalledWith(2, expect.objectContaining({ assetSrc: "asset-qwen3-600m" }));
  expect(resident()).toBe(true);
});

it("ensure of a different key while another is resident unloads the old with clearStorage true", async () => {
  sdk.downloadAsset.mockResolvedValue(undefined);
  await service.ensureModel(KEY_A);
  await service.ensureModel(KEY_B);
  expect(sdk.unloadModel).toHaveBeenCalledWith({ modelId: "model-handle", clearStorage: true });
  expect(sdk.loadModel).toHaveBeenCalledTimes(2);
  expect(resident()).toBe(true);
});

it("retry after a failed download works: state cleared on error, second ensure loads", async () => {
  sdk.downloadAsset.mockRejectedValueOnce(new Error("network down")).mockResolvedValue(undefined);
  const statuses: string[] = [];

  await expect(service.ensureModel(KEY_A, (_pct, s) => statuses.push(s))).rejects.toThrow("network down");
  expect(statuses[statuses.length - 1]).toBe("error");
  expect(resident()).toBe(false);

  await service.ensureModel(KEY_A);
  expect(sdk.loadModel).toHaveBeenCalledTimes(1);
  expect(resident()).toBe(true);
});

it("a rejected turn doesn't stall the chain: release still runs after a failed load", async () => {
  sdk.downloadAsset.mockRejectedValue(new Error("network down"));
  const e1 = service.ensureModel(KEY_A).catch(() => {});
  const r1 = service.releaseModel({ deleteFile: false });
  await Promise.all([e1, r1]);
  expect(resident()).toBe(false);
});

it("release cancels in-flight completions before unloading", async () => {
  sdk.downloadAsset.mockResolvedValue(undefined);
  await service.ensureModel(KEY_A);

  const final = deferred<{ stopReason: string }>();
  sdk.completion.mockReturnValue({
    requestId: "req-live",
    events: (async function* () { await final.promise; })(),
    final: final.promise,
  });
  service.streamAdvice([], { onContent: () => {} });

  const release = service.releaseModel({ deleteFile: false });
  final.resolve({ stopReason: "stop" });
  await release;

  expect(sdk.cancel).toHaveBeenCalledWith({ requestId: "req-live" });
  expect(sdk.unloadModel).toHaveBeenCalledTimes(1);
});
