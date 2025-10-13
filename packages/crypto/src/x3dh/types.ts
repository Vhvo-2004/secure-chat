// identityKey pair now includes separate X25519 (for DH) and Ed25519 (for signatures) components.
export interface IdentityKeyPair {
  publicKey: Uint8Array;        // X25519 public
  privateKey: Uint8Array;       // X25519 private
  signingPublicKey: Uint8Array; // Ed25519 public
  signingPrivateKey: Uint8Array;// Ed25519 private (seed)
}
export interface SignedPreKeyPair { publicKey: Uint8Array; privateKey: Uint8Array; signature: Uint8Array; }
export interface OneTimePreKey { publicKey: Uint8Array; privateKey: Uint8Array; id: string; }

export interface X3DHBundle {
  identityKey: Uint8Array;
  // Separate signing public key (Ed25519) for verifying signed pre-key
  signingPublicKey?: Uint8Array;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  oneTimePreKeys: { id: string; key: Uint8Array }[];
}

export interface X3DHSharedSecretResult {
  masterKey: Uint8Array; // 32 bytes root key
  encKey: Uint8Array; // 24 bytes for 3DES (educational placeholder)
  macKey: Uint8Array; // 32 bytes HMAC key
  info: {
    dhParts: { dh1: Uint8Array; dh2: Uint8Array; dh3: Uint8Array; dh4?: Uint8Array };
    usedOneTimePreKeyId?: string;
  };
}

export interface X3DHInitOptions {
  // Optional external randomness provider for deterministic testing
  randomBytes?: (len: number) => Uint8Array;
}

export interface X3DHKeyMaterial {
  identityKey: IdentityKeyPair;
  signedPreKey: SignedPreKeyPair;
  oneTimePreKeys: OneTimePreKey[];
}

export interface SignatureVerificationResult {
  ok: boolean;
  reason?: string;
}
