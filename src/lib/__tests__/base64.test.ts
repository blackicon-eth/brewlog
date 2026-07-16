import { base64ToBytes } from "../base64";

it("decodes standard base64 to the original bytes", () => {
  // "Hi!" => SGkh
  expect(Array.from(base64ToBytes("SGkh"))).toEqual([72, 105, 33]);
});
it("decodes bytes with padding", () => {
  // "Man" => TWFu (no pad); "Ma" => TWE= ; "M" => TQ==
  expect(Array.from(base64ToBytes("TWE="))).toEqual([77, 97]);
  expect(Array.from(base64ToBytes("TQ=="))).toEqual([77]);
});
it("round-trips arbitrary bytes via btoa", () => {
  const bytes = Uint8Array.from([0, 1, 2, 254, 255, 128]);
  const b64 = Buffer.from(bytes).toString("base64");
  expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
});
