import { ed25519, x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '../kdf/hkdf.js';
import {
  IdentityKeyPair,
  SignedPreKeyPair,
  OneTimePreKey,
  X3DHSharedSecretResult,
  X3DHKeyMaterial,
  X3DHBundle,
  X3DHInitOptions
} from './types.js';

function defaultRandomBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buf);
    return buf;
  }
  // Node.js fallback using Web Crypto if available
  try {
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(buf);
      return buf;
    }
  } catch {}
  return buf;
}

// No Node-specific fallback; in non-WebCrypto environments, defaultRandomBytes returns zeros (educational only)

function generateKeyPair(randomBytesFn = defaultRandomBytes): IdentityKeyPair {
  // X25519 for DH
  const dhPriv = x25519.utils.randomPrivateKey();
  const dhPub = x25519.getPublicKey(dhPriv);
  // Ed25519 for signatures
  const seed = randomBytesFn(32);
  const signingPriv = seed; // ed25519.sign takes 32-byte private seed
  const signingPub = ed25519.getPublicKey(signingPriv);
  return { publicKey: dhPub, privateKey: dhPriv, signingPublicKey: signingPub, signingPrivateKey: signingPriv };
}

export function generateIdentityKeyPair(opts?: X3DHInitOptions): IdentityKeyPair {
  return generateKeyPair(opts?.randomBytes);
}

export function generateSignedPreKey(identityKey: IdentityKeyPair, opts?: X3DHInitOptions): SignedPreKeyPair {
  const kp = generateKeyPair(opts?.randomBytes);
  const signature = ed25519.sign(kp.publicKey, identityKey.signingPrivateKey);
  return { publicKey: kp.publicKey, privateKey: kp.privateKey, signature };
}

export function verifySignedPreKey(identitySigningPublicKey: Uint8Array, signedPreKeyPublic: Uint8Array, signature: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, signedPreKeyPublic, identitySigningPublicKey);
  } catch {
    return false;
  }
}

export function generateOneTimePreKeys(count: number, opts?: X3DHInitOptions): OneTimePreKey[] {
  const result: OneTimePreKey[] = [];
  for (let i = 0; i < count; i++) {
    const kp = generateKeyPair(opts?.randomBytes);
    result.push({ publicKey: kp.publicKey, privateKey: kp.privateKey, id: `otpk-${i}` });
  }
  return result;
}

export function createKeyMaterial(oneTimeCount = 5, opts?: X3DHInitOptions): X3DHKeyMaterial {
  const identityKey = generateIdentityKeyPair(opts);
  const signedPreKey = generateSignedPreKey(identityKey, opts);
  const oneTimePreKeys = generateOneTimePreKeys(oneTimeCount, opts);
  return { identityKey, signedPreKey, oneTimePreKeys };
}

export function exportBundle(material: X3DHKeyMaterial): X3DHBundle {
  return {
    identityKey: material.identityKey.publicKey,
    signingPublicKey: material.identityKey.signingPublicKey,
    signedPreKey: material.signedPreKey.publicKey,
    signedPreKeySignature: material.signedPreKey.signature,
    oneTimePreKeys: material.oneTimePreKeys.map(k => ({ id: k.id, key: k.publicKey }))
  };
}

interface InitiatorParams {
  // Sender (Alice)
  senderIdentityKey: IdentityKeyPair;
  // Ephemeral key generated for this session by Alice
  senderEphemeralKey?: IdentityKeyPair;
  // Receiver (Bob) bundle parts
  receiverIdentityKey: Uint8Array;
  receiverSignedPreKey: Uint8Array;
  receiverSignedPreKeySignature: Uint8Array;
  receiverOneTimePreKey?: { id: string; key: Uint8Array };
  info?: Uint8Array; // optional context label
}

export function initiatorDeriveSharedSecret(params: InitiatorParams): X3DHSharedSecretResult {
  const eph = params.senderEphemeralKey || generateKeyPair();

  // Perform DH computations (X25519)
  const dh1 = x25519.getSharedSecret(params.senderIdentityKey.privateKey, params.receiverSignedPreKey); // IK_A x SPK_B
  const dh2 = x25519.getSharedSecret(eph.privateKey, params.receiverIdentityKey); // EK_A x IK_B
  const dh3 = x25519.getSharedSecret(eph.privateKey, params.receiverSignedPreKey); // EK_A x SPK_B
  let dh4: Uint8Array | undefined;
  let usedOneTimePreKeyId: string | undefined;
  if (params.receiverOneTimePreKey) {
    dh4 = x25519.getSharedSecret(eph.privateKey, params.receiverOneTimePreKey.key); // EK_A x OPK_B
    usedOneTimePreKeyId = params.receiverOneTimePreKey.id;
  }

  const concat = dh4 ? concatBytes(dh1, dh2, dh3, dh4) : concatBytes(dh1, dh2, dh3);

  // HKDF to derive master → enc + mac keys. Salt omitted (set all zeros) for educational simplicity.
  const zeroSalt = new Uint8Array(32); // DO NOT do this in production.
  const masterKey = hkdf(concat, zeroSalt, params.info || new Uint8Array(), 32);
  // Derive subkeys from master (simple expansion). In a real design you'd use a proper KDF chain.
  const encKey = hkdf(masterKey, zeroSalt, new TextEncoder().encode('ENC'), 24); // 24 bytes for 3DES
  const macKey = hkdf(masterKey, zeroSalt, new TextEncoder().encode('MAC'), 32);

  return {
    masterKey,
    encKey,
    macKey,
    info: {
      dhParts: { dh1, dh2, dh3, dh4 },
      usedOneTimePreKeyId
    }
  };
}

interface ResponderParams {
  receiverIdentityKey: IdentityKeyPair; // Bob
  receiverSignedPreKey: SignedPreKeyPair; // Bob SPK
  receiverOneTimePreKey?: OneTimePreKey; // Bob OTPK (may have been consumed)
  senderIdentityKey: Uint8Array; // Alice IK (X25519 public)
  senderEphemeralKey: Uint8Array; // Alice EK
  info?: Uint8Array;
  // Optional: Alice's signing key for verifying her signed prekey if scenario extended
}

export function responderDeriveSharedSecret(params: ResponderParams): X3DHSharedSecretResult {
  // (Optional future) verify initiator's signed prekey if used. For now we verify OWN signed pre-key consistency
  // by re-signing would defeat purpose; instead rely on verifySignedPreKey in external handshake validation.
  // Mirror computations from Bob’s perspective
  const dh1 = x25519.getSharedSecret(params.receiverSignedPreKey.privateKey, params.senderIdentityKey); // SPK_B x IK_A
  const dh2 = x25519.getSharedSecret(params.receiverIdentityKey.privateKey, params.senderEphemeralKey); // IK_B x EK_A
  const dh3 = x25519.getSharedSecret(params.receiverSignedPreKey.privateKey, params.senderEphemeralKey); // SPK_B x EK_A
  let dh4: Uint8Array | undefined;
  let usedOneTimePreKeyId: string | undefined;
  if (params.receiverOneTimePreKey) {
    dh4 = x25519.getSharedSecret(params.receiverOneTimePreKey.privateKey, params.senderEphemeralKey); // OPK_B x EK_A
    usedOneTimePreKeyId = params.receiverOneTimePreKey.id;
  }
  const concat = dh4 ? concatBytes(dh1, dh2, dh3, dh4) : concatBytes(dh1, dh2, dh3);
  const zeroSalt = new Uint8Array(32);
  const masterKey = hkdf(concat, zeroSalt, params.info || new Uint8Array(), 32);
  const encKey = hkdf(masterKey, zeroSalt, new TextEncoder().encode('ENC'), 24);
  const macKey = hkdf(masterKey, zeroSalt, new TextEncoder().encode('MAC'), 32);
  return {
    masterKey,
    encKey,
    macKey,
    info: {
      dhParts: { dh1, dh2, dh3, dh4 },
      usedOneTimePreKeyId
    }
  };
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrs) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// Backwards compatibility alias (throws before) now not needed, but keep a named export.
export async function deriveX3DHSharedSecret(): Promise<X3DHSharedSecretResult> {
  throw new Error('Use initiatorDeriveSharedSecret / responderDeriveSharedSecret instead.');
}
