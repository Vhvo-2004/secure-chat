import { describe, it, expect } from 'vitest';
import {
  createKeyMaterial,
  exportBundle,
  initiatorDeriveSharedSecret,
  responderDeriveSharedSecret,
  generateIdentityKeyPair,
  verifySignedPreKey
} from '../src/x3dh/x3dh.js';
import { x25519 } from '@noble/curves/ed25519';

// Helper to extract Alice's ephemeral public key via recomputation (test-only transparency).
function recoverEphemeralFromDhParts(aliceIdentityPriv: Uint8Array, bobIdentityPub: Uint8Array, dh2: Uint8Array): Uint8Array {
  // dh2 = X25519(EK_A, IK_B). We cannot invert X25519, so instead we adjust the implementation to expose ephemeral key in future.
  // For now we skip this and modify production code would be required; instead we restructure the test to avoid this hack.
  throw new Error('Not used after test refactor');
}

describe('X3DH basic handshake', () => {
  it('derives matching keys with one-time prekey', () => {
    // Bob prepares material
    const bobMaterial = createKeyMaterial(2);
    const bobBundle = exportBundle(bobMaterial);
    const otpk = bobBundle.oneTimePreKeys[0];

    // Alice creates her own identity & ephemeral key
    const aliceIdentity = generateIdentityKeyPair();
    const aliceEphemeral = generateIdentityKeyPair();

    const aliceResult = initiatorDeriveSharedSecret({
      senderIdentityKey: aliceIdentity,
      senderEphemeralKey: aliceEphemeral,
      receiverIdentityKey: bobBundle.identityKey,
      receiverSignedPreKey: bobBundle.signedPreKey,
      receiverSignedPreKeySignature: bobBundle.signedPreKeySignature,
      receiverOneTimePreKey: otpk
    });

    const responderResult = responderDeriveSharedSecret({
      receiverIdentityKey: bobMaterial.identityKey,
      receiverSignedPreKey: bobMaterial.signedPreKey,
      receiverOneTimePreKey: bobMaterial.oneTimePreKeys.find(k => k.id === otpk.id),
      senderIdentityKey: aliceIdentity.publicKey,
      senderEphemeralKey: aliceEphemeral.publicKey
    });

    expect(aliceResult.masterKey).toHaveLength(32);
    expect(responderResult.masterKey).toHaveLength(32);
    expect(Buffer.from(aliceResult.masterKey)).toStrictEqual(Buffer.from(responderResult.masterKey));
    expect(Buffer.from(aliceResult.encKey)).toStrictEqual(Buffer.from(responderResult.encKey));
    expect(Buffer.from(aliceResult.macKey)).toStrictEqual(Buffer.from(responderResult.macKey));
    expect(aliceResult.info.usedOneTimePreKeyId).toBe(otpk.id);
  });

  it('verifies signed prekey signature', () => {
    const material = createKeyMaterial(1);
    const bundle = exportBundle(material);
    const ok = verifySignedPreKey(
      material.identityKey.signingPublicKey,
      material.signedPreKey.publicKey,
      material.signedPreKey.signature
    );
    expect(ok).toBe(true);
  });

  it('derives matching keys without one-time prekey', () => {
    const bobMaterial = createKeyMaterial(0);
    const bobBundle = exportBundle(bobMaterial);
    const aliceIdentity = generateIdentityKeyPair();
    const aliceEphemeral = generateIdentityKeyPair();

    const aliceResult = initiatorDeriveSharedSecret({
      senderIdentityKey: aliceIdentity,
      senderEphemeralKey: aliceEphemeral,
      receiverIdentityKey: bobBundle.identityKey,
      receiverSignedPreKey: bobBundle.signedPreKey,
      receiverSignedPreKeySignature: bobBundle.signedPreKeySignature
    });
    const responderResult = responderDeriveSharedSecret({
      receiverIdentityKey: bobMaterial.identityKey,
      receiverSignedPreKey: bobMaterial.signedPreKey,
      senderIdentityKey: aliceIdentity.publicKey,
      senderEphemeralKey: aliceEphemeral.publicKey
    });
    expect(Buffer.from(aliceResult.masterKey)).toStrictEqual(Buffer.from(responderResult.masterKey));
  });
});
