// Minimal Triple DES (3DES) implementation in pure JavaScript for the browser.
// The code below follows the FIPS PUB 46-3 specification and is sufficient for
// encrypting small chat payloads using DES-EDE3 in CBC mode with PKCS#7 padding.
//
// This implementation is intentionally self-contained to avoid external
// dependencies (e.g. crypto-js) which are not available in the execution
// environment. It is NOT optimised for performance but is adequate for
// short chat messages.

import { toB64, fromB64 } from './utils';

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2,
  60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6,
  64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1,
  59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5,
  63, 55, 47, 39, 31, 23, 15, 7,
];

const IP_INV = [
  40, 8, 48, 16, 56, 24, 64, 32,
  39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30,
  37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28,
  35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26,
  33, 1, 41, 9, 49, 17, 57, 25,
];

const E = [
  32, 1, 2, 3, 4, 5,
  4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13,
  12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21,
  20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29,
  28, 29, 30, 31, 32, 1,
];

const P = [
  16, 7, 20, 21,
  29, 12, 28, 17,
  1, 15, 23, 26,
  5, 18, 31, 10,
  2, 8, 24, 14,
  32, 27, 3, 9,
  19, 13, 30, 6,
  22, 11, 4, 25,
];

const PC1 = [
  57, 49, 41, 33, 25, 17, 9,
  1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27,
  19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15,
  7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29,
  21, 13, 5, 28, 20, 12, 4,
];

const PC2 = [
  14, 17, 11, 24, 1, 5,
  3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8,
  16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55,
  30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53,
  46, 42, 50, 36, 29, 32,
];

const ROTATIONS = [
  1, 1, 2, 2, 2, 2, 2, 2,
  1, 2, 2, 2, 2, 2, 2, 1,
];

const SBOXES = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
  ],
];

function permute(input, table, inputBits) {
  let output = 0n;
  for (let i = 0; i < table.length; i++) {
    const bitPos = BigInt(inputBits - table[i]);
    const bit = (input >> bitPos) & 1n;
    output = (output << 1n) | bit;
  }
  return output;
}

function leftRotate28(value, shift) {
  const mask = (1n << 28n) - 1n;
  const val = value & mask;
  const shifted = ((val << BigInt(shift)) & mask) | (val >> BigInt(28 - shift));
  return shifted;
}

function generateSubKeys(keyBytes) {
  if (keyBytes.length !== 8) {
    throw new Error('DES key must be 8 bytes');
  }
  let key = 0n;
  for (let i = 0; i < 8; i++) {
    key = (key << 8n) | BigInt(keyBytes[i]);
  }
  const permuted = permute(key, PC1, 64);
  let c = permuted >> 28n;
  let d = permuted & ((1n << 28n) - 1n);

  const subKeys = [];
  for (let i = 0; i < 16; i++) {
    c = leftRotate28(c, ROTATIONS[i]);
    d = leftRotate28(d, ROTATIONS[i]);
    const combined = (c << 28n) | d;
    const subKey = permute(combined, PC2, 56);
    subKeys.push(subKey);
  }
  return subKeys;
}

function expand32to48(value) {
  return permute(value, E, 32);
}

function substitute(x48) {
  let result = 0n;
  for (let i = 0; i < 8; i++) {
    const sixBits = Number((x48 >> BigInt((7 - i) * 6)) & 0x3fn);
    const row = ((sixBits & 0x20) >> 4) | (sixBits & 0x01);
    const col = (sixBits >> 1) & 0x0f;
    const sValue = SBOXES[i][row][col];
    result = (result << 4n) | BigInt(sValue);
  }
  return result;
}

function feistel(right32, subKey48) {
  const expanded = expand32to48(right32);
  const xored = expanded ^ subKey48;
  const substituted = substitute(xored);
  const permuted = permute(substituted, P, 32);
  return permuted;
}

function desRound(block64, subKeys, decrypt = false) {
  const permuted = permute(block64, IP, 64);
  let left = permuted >> 32n;
  let right = permuted & 0xffffffffn;

  const rounds = decrypt ? [...subKeys].reverse() : subKeys;
  for (let i = 0; i < 16; i++) {
    const temp = right;
    const fRes = feistel(right, rounds[i]);
    right = left ^ fRes;
    left = temp;
  }
  const preOutput = (right << 32n) | left;
  const finalBlock = permute(preOutput, IP_INV, 64);
  return finalBlock;
}

function blockFromBytes(bytes, offset) {
  let block = 0n;
  for (let i = 0; i < 8; i++) {
    block = (block << 8n) | BigInt(bytes[offset + i]);
  }
  return block;
}

function blockToBytes(block) {
  const out = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(block & 0xffn);
    block >>= 8n;
  }
  return out;
}

function xorBlocks(a, b) {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    out[i] = a[i] ^ b[i];
  }
  return out;
}

function pkcs7Pad(data) {
  const blockSize = 8;
  const padLen = blockSize - (data.length % blockSize || blockSize);
  const out = new Uint8Array(data.length + padLen);
  out.set(data, 0);
  out.fill(padLen, data.length);
  return out;
}

function pkcs7Unpad(data) {
  if (data.length === 0 || data.length % 8 !== 0) {
    throw new Error('Invalid padded data length');
  }
  const padLen = data[data.length - 1];
  if (padLen <= 0 || padLen > 8) {
    throw new Error('Invalid padding');
  }
  for (let i = 1; i <= padLen; i++) {
    if (data[data.length - i] !== padLen) {
      throw new Error('Bad padding');
    }
  }
  return data.slice(0, data.length - padLen);
}

function ensureKey24(keyBytes) {
  if (keyBytes.length !== 24) {
    throw new Error('3DES key must have 24 bytes');
  }
}

function tripleDesProcess(data, keyBytes, ivBytes, encrypt = true) {
  ensureKey24(keyBytes);
  if (ivBytes.length !== 8) {
    throw new Error('3DES IV must have 8 bytes');
  }

  const k1 = generateSubKeys(keyBytes.slice(0, 8));
  const k2 = generateSubKeys(keyBytes.slice(8, 16));
  const k3 = generateSubKeys(keyBytes.slice(16, 24));

  const blocks = data.length / 8;
  const output = new Uint8Array(data.length);
  let prev = ivBytes;

  for (let i = 0; i < blocks; i++) {
    const offset = i * 8;
    let blockBytes = data.slice(offset, offset + 8);

    if (encrypt) {
      blockBytes = xorBlocks(blockBytes, prev);
      let block = blockFromBytes(blockBytes, 0);
      block = desRound(block, k1, false);
      block = desRound(block, k2, true);
      block = desRound(block, k3, false);
      const encrypted = blockToBytes(block);
      output.set(encrypted, offset);
      prev = encrypted;
    } else {
      const block = blockFromBytes(blockBytes, 0);
      let temp = desRound(block, k3, true);
      temp = desRound(temp, k2, false);
      temp = desRound(temp, k1, true);
      let decrypted = blockToBytes(temp);
      decrypted = xorBlocks(decrypted, prev);
      output.set(decrypted, offset);
      prev = blockBytes;
    }
  }

  return output;
}

export function encrypt3DESCbc(plainBytes, keyBytes, ivBytes) {
  const padded = pkcs7Pad(plainBytes);
  return tripleDesProcess(padded, keyBytes, ivBytes, true);
}

export function decrypt3DESCbc(cipherBytes, keyBytes, ivBytes) {
  const decrypted = tripleDesProcess(cipherBytes, keyBytes, ivBytes, false);
  return pkcs7Unpad(decrypted);
}

export function random3DesKey() {
  const key = new Uint8Array(24);
  crypto.getRandomValues(key);
  return key;
}

export function generateIv() {
  const iv = new Uint8Array(8);
  crypto.getRandomValues(iv);
  return iv;
}

export function encryptMessage3DES(message, keyBase64) {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(message);
  const keyBytes = fromB64(keyBase64);
  const iv = generateIv();
  const cipherBytes = encrypt3DESCbc(plainBytes, keyBytes, iv);
  return {
    ciphertext: toB64(cipherBytes),
    iv: toB64(iv),
  };
}

export function decryptMessage3DES(cipherBase64, keyBase64, ivBase64) {
  const keyBytes = fromB64(keyBase64);
  const cipherBytes = fromB64(cipherBase64);
  const ivBytes = fromB64(ivBase64);
  const plainBytes = decrypt3DESCbc(cipherBytes, keyBytes, ivBytes);
  const decoder = new TextDecoder();
  return decoder.decode(plainBytes);
}
