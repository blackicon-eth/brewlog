// Decode base64 to raw bytes. `atob` is available in React Native (Hermes) and Node.
// Used to materialize imported photo files from the ledger's base64 payload.
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
