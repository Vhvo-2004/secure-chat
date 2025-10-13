import * as CryptoJS from 'crypto-js';

export interface TripleDESEncryptResult {
  ivB64: string;
  ctB64: string;
  macB64: string;
}

// NOTE: Educational only. 3DES is deprecated.
export function encrypt3DESCBC(plaintext: Uint8Array, key24: Uint8Array, macKey: Uint8Array): TripleDESEncryptResult {
  if (key24.length !== 24) throw new Error('3DES key must be 24 bytes');
  const iv = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(iv);
  } else {
    // fallback insecure RNG for non-browser envs without WebCrypto
    for (let i = 0; i < iv.length; i++) iv[i] = (Math.random() * 256) | 0;
  }
  const keyWords = CryptoJS.lib.WordArray.create(key24 as any);
  const ivWords = CryptoJS.lib.WordArray.create(iv as any);
  const ptWords = CryptoJS.lib.WordArray.create(plaintext as any);
  const encrypted = CryptoJS.TripleDES.encrypt(ptWords, keyWords, { iv: ivWords, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  const ctWords = encrypted.ciphertext;
  const ctB64 = ctWords.toString(CryptoJS.enc.Base64);
  // HMAC-SHA256 over (iv || ciphertext)
  const macKeyWords = CryptoJS.lib.WordArray.create(macKey as any);
  const msgWords = ivWords.clone().concat(ctWords);
  const mac = CryptoJS.HmacSHA256(msgWords, macKeyWords);
  const macB64 = CryptoJS.enc.Base64.stringify(mac);
  const ivB64 = CryptoJS.enc.Base64.stringify(ivWords);
  return { ivB64, ctB64, macB64 };
}

export function decrypt3DESCBC(res: TripleDESEncryptResult, key24: Uint8Array, macKey: Uint8Array): Uint8Array {
  const { ivB64, ctB64, macB64 } = res;
  const keyWords = CryptoJS.lib.WordArray.create(key24 as any);
  const ivWords = CryptoJS.enc.Base64.parse(ivB64);
  const ctWords = CryptoJS.enc.Base64.parse(ctB64);
  const macKeyWords = CryptoJS.lib.WordArray.create(macKey as any);
  const msgWords = ivWords.clone().concat(ctWords);
  const expectedMac = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(msgWords, macKeyWords));
  if (expectedMac !== macB64) throw new Error('MAC mismatch');
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ctWords });
  const decrypted = CryptoJS.TripleDES.decrypt(cipherParams, keyWords, { iv: ivWords, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  // Convert WordArray to Uint8Array
  const hex = decrypted.toString(CryptoJS.enc.Hex);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
