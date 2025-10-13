import { describe, it, expect } from 'vitest';
import { hkdfSha256 } from '../src/kdf/hkdf.js';

function toBytes(hex: string) { return new Uint8Array(Buffer.from(hex, 'hex')); }

describe('hkdfSha256', () => {
  it('derives length deterministically', () => {
    const ikm = toBytes('0b0b0b0b0b0b0b0b0b0b0b');
    const salt = toBytes('000102030405060708090a0b0c');
    const info = toBytes('f0f1f2f3f4f5f6f7f8f9');
    const out = hkdfSha256(ikm, salt, info, 42);
    expect(out.length).toBe(42);
    const out2 = hkdfSha256(ikm, salt, info, 42);
    expect(Buffer.from(out).toString('hex')).toBe(Buffer.from(out2).toString('hex'));
  });
});
