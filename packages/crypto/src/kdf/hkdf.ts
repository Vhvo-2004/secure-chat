import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

export function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const mac = (key: Uint8Array, data: Uint8Array) => hmac(sha256, key, data);
  const prk = mac(salt, ikm);
  let t = new Uint8Array(0);
  const out = new Uint8Array(length);
  let pos = 0;
  let c = 1;
  while (pos < length) {
    const stepRaw = mac(prk, concatBytes(t, info, new Uint8Array([c])));
    const step = new Uint8Array(stepRaw); // normalize to standard Uint8Array buffer type
    const take = Math.min(step.length, length - pos);
    out.set(step.subarray(0, take), pos);
    pos += take;
    t = step;
    c++;
  }
  return out;
}

// Backwards-compatible alias used by X3DH implementation
export const hkdf = hkdfSha256;
