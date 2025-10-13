import { describe, it, expect } from 'vitest';
import { encrypt3DESCBC, decrypt3DESCBC } from '../src/symmetric/tripleDes.js';

function randBytes(n: number) { return crypto.getRandomValues(new Uint8Array(n)); }

describe('3DES (educational) roundtrip', () => {
  it('encrypts and decrypts', () => {
    const key = new Uint8Array(24).fill(1); // demo key (not secure)
    const macKey = new Uint8Array(32).fill(2);
    const msg = new TextEncoder().encode('hello world');
    const enc = encrypt3DESCBC(msg, key, macKey);
    const dec = decrypt3DESCBC(enc, key, macKey);
    expect(new TextDecoder().decode(dec)).toBe('hello world');
  });
});
