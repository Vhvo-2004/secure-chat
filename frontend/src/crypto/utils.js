// utils.js
// utilitários: base64 <-> Uint8Array e concatenação

export function toB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromB64(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    u8[i] = bin.charCodeAt(i);
  }
  return u8;
}

export function concatUint8Arrays(arrays) {
  const total = arrays.reduce((sum, arr) => sum + (arr ? arr.length : 0), 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    if (!arr || arr.length === 0) continue;
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}
