import nacl from 'tweetnacl';
import { toB64, fromB64, concatUint8Arrays } from './utils';

const encoder = new TextEncoder();

function encodeInfo(label) {
  return encoder.encode(label);
}

async function hkdfBytes(input, infoLabel, length = 32, salt) {
  const saltBytes = salt ?? new Uint8Array(16);
  const info = encodeInfo(infoLabel);
  const master = await crypto.subtle.importKey('raw', input, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes,
      info,
    },
    master,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function importAesKey(rawBytes) {
  return crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function aesGcmEncrypt(rawKeyBytes, plaintext, additionalData) {
  const key = await importAesKey(rawKeyBytes);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: additionalData ?? new Uint8Array(0),
      tagLength: 128,
    },
    key,
    plaintext,
  );
  return { iv, ciphertext: new Uint8Array(cipher) };
}

async function aesGcmDecrypt(rawKeyBytes, iv, cipher, additionalData) {
  const key = await importAesKey(rawKeyBytes);
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: additionalData ?? new Uint8Array(0),
      tagLength: 128,
    },
    key,
    cipher,
  );
  return new Uint8Array(plain);
}

export function generateBundle(numOpks = 10) {
  const identityKeyBox = nacl.box.keyPair();
  const identityKeySign = nacl.sign.keyPair();
  const signedPreKey = nacl.box.keyPair();
  const signature = nacl.sign.detached(signedPreKey.publicKey, identityKeySign.secretKey);
  const oneTimePreKeys = Array.from({ length: numOpks }, () => nacl.box.keyPair());

  return {
    identityKeyBox,
    identityKeySign,
    signedPreKey,
    signature,
    oneTimePreKeys,
  };
}

export function exportPublicBundle(bundle) {
  return {
    identityKeyBox: toB64(bundle.identityKeyBox.publicKey),
    identityKeySign: toB64(bundle.identityKeySign.publicKey),
    signedPreKey: toB64(bundle.signedPreKey.publicKey),
    signature: toB64(bundle.signature),
    oneTimePreKeys: bundle.oneTimePreKeys.map((keyPair, index) => ({
      index,
      key: toB64(keyPair.publicKey),
    })),
  };
}

export function serializePrivateBundle(bundle) {
  return {
    identityKeyBox: {
      publicKey: toB64(bundle.identityKeyBox.publicKey),
      secretKey: toB64(bundle.identityKeyBox.secretKey),
    },
    identityKeySign: {
      publicKey: toB64(bundle.identityKeySign.publicKey),
      secretKey: toB64(bundle.identityKeySign.secretKey),
    },
    signedPreKey: {
      publicKey: toB64(bundle.signedPreKey.publicKey),
      secretKey: toB64(bundle.signedPreKey.secretKey),
    },
    signature: toB64(bundle.signature),
    oneTimePreKeys: bundle.oneTimePreKeys.map((kp, index) => ({
      index,
      publicKey: toB64(kp.publicKey),
      secretKey: toB64(kp.secretKey),
    })),
  };
}

export function deserializePrivateBundle(serialized) {
  return {
    identityKeyBox: {
      publicKey: fromB64(serialized.identityKeyBox.publicKey),
      secretKey: fromB64(serialized.identityKeyBox.secretKey),
    },
    identityKeySign: {
      publicKey: fromB64(serialized.identityKeySign.publicKey),
      secretKey: fromB64(serialized.identityKeySign.secretKey),
    },
    signedPreKey: {
      publicKey: fromB64(serialized.signedPreKey.publicKey),
      secretKey: fromB64(serialized.signedPreKey.secretKey),
    },
    signature: fromB64(serialized.signature),
    oneTimePreKeys: serialized.oneTimePreKeys.map((kp) => ({
      index: kp.index,
      publicKey: fromB64(kp.publicKey),
      secretKey: fromB64(kp.secretKey),
    })),
  };
}

function ensureReceiverBundle(bundle) {
  const { identityKeyBox, identityKeySign, signedPreKey, signature } = bundle;
  if (!identityKeyBox || !identityKeySign || !signedPreKey || !signature) {
    throw new Error('Incomplete receiver bundle');
  }
}

export async function performX3DHInitiatorAndCreatePacket(initiatorBundle, receiverBundle) {
  ensureReceiverBundle(receiverBundle);

  const SPK_B_pub = fromB64(receiverBundle.signedPreKey);
  const IKsig_B_pub = fromB64(receiverBundle.identityKeySign);
  const sig = fromB64(receiverBundle.signature);
  if (!nacl.sign.detached.verify(SPK_B_pub, sig, IKsig_B_pub)) {
    throw new Error('Signed pre-key verification failed');
  }

  const IK_A = initiatorBundle.identityKeyBox;
  const EK_A = nacl.box.keyPair();
  const IK_B_pub = fromB64(receiverBundle.identityKeyBox);
  const opkInfo = receiverBundle.oneTimePreKey ?? null;
  const OPK_B_pub = opkInfo ? fromB64(opkInfo.key) : null;

  const dh1 = nacl.scalarMult(IK_A.secretKey, SPK_B_pub);
  const dh2 = nacl.scalarMult(EK_A.secretKey, IK_B_pub);
  const dh3 = nacl.scalarMult(EK_A.secretKey, SPK_B_pub);
  const dh4 = OPK_B_pub ? nacl.scalarMult(EK_A.secretKey, OPK_B_pub) : new Uint8Array(0);
  const sharedSecret = concatUint8Arrays([dh1, dh2, dh3, dh4]);

  const initKeyBytes = await hkdfBytes(sharedSecret, 'X3DH init');
  const rootKeyBytes = await hkdfBytes(sharedSecret, 'X3DH root');

  const Xbytes = concatUint8Arrays([IK_A.publicKey, IK_B_pub]);
  const aadObj = {
    opkIndex: opkInfo ? opkInfo.index : null,
    timestamp: Date.now(),
  };
  const aadBytes = encoder.encode(JSON.stringify(aadObj));
  const { iv, ciphertext } = await aesGcmEncrypt(initKeyBytes, Xbytes, aadBytes);

  const packet = {
    EK_A_pub: toB64(EK_A.publicKey),
    IK_A_pub: toB64(IK_A.publicKey),
    opk_index: opkInfo ? opkInfo.index : null,
    iv: toB64(iv),
    cipher: toB64(ciphertext),
    aad: toB64(aadBytes),
  };

  return {
    packet,
    rootKeyBytes,
    usedOpkIndex: opkInfo ? opkInfo.index : null,
  };
}

function normalizeOpkIndex(rawIndex) {
  if (rawIndex === null || rawIndex === undefined) {
    return null;
  }
  const parsed = typeof rawIndex === 'string' ? parseInt(rawIndex, 10) : rawIndex;
  return Number.isFinite(parsed) ? parsed : null;
}

function collectPreKeyCandidates(bundle, indicatedIndex) {
  const map = new Map();
  bundle.oneTimePreKeys.forEach((kp, idx) => {
    if (!kp) return;
    const resolvedIndex = kp.index ?? idx;
    if (!map.has(resolvedIndex)) {
      map.set(resolvedIndex, kp);
    }
  });

  const candidates = [];
  if (indicatedIndex !== null) {
    candidates.push({ index: indicatedIndex, preKey: map.get(indicatedIndex) ?? null });
    map.delete(indicatedIndex);
  } else {
    candidates.push({ index: null, preKey: null });
  }

  for (const [idx, kp] of map.entries()) {
    candidates.push({ index: idx, preKey: kp });
  }

  if (indicatedIndex !== null && !candidates.some((candidate) => candidate.index === null)) {
    candidates.push({ index: null, preKey: null });
  }

  return candidates;
}

function shouldRetryFallback(err) {
  if (!err) return false;
  const message = err.message ?? '';
  if (message.includes('One-time pre-key not found')) {
    return true;
  }
  if (err.name === 'OperationError' || message.includes('OperationError')) {
    return true;
  }
  if (err.name === 'DOMException' && (message.includes('decrypt') || message.includes('operation'))) {
    return true;
  }
  return false;
}

async function attemptResponderDecryption(bundle, packet, candidate) {
  const EK_A_pub = fromB64(packet.EK_A_pub);
  const IK_A_pub = fromB64(packet.IK_A_pub);
  const IK_B = bundle.identityKeyBox;
  const SPK_B = bundle.signedPreKey;
  const opkSecret = candidate.preKey ? candidate.preKey.secretKey : null;

  const dh1 = nacl.scalarMult(SPK_B.secretKey, IK_A_pub);
  const dh2 = nacl.scalarMult(IK_B.secretKey, EK_A_pub);
  const dh3 = nacl.scalarMult(SPK_B.secretKey, EK_A_pub);
  const dh4 = opkSecret ? nacl.scalarMult(opkSecret, EK_A_pub) : new Uint8Array(0);
  const sharedSecret = concatUint8Arrays([dh1, dh2, dh3, dh4]);

  const initKeyBytes = await hkdfBytes(sharedSecret, 'X3DH init');
  const rootKeyBytes = await hkdfBytes(sharedSecret, 'X3DH root');

  const aadBytes = packet.aad ? fromB64(packet.aad) : new Uint8Array(0);
  const iv = fromB64(packet.iv);
  const cipher = fromB64(packet.cipher);
  const plain = await aesGcmDecrypt(initKeyBytes, iv, cipher, aadBytes);
  const IK_A_pub_fromX = plain.slice(0, 32);
  const IK_B_pub_fromX = plain.slice(32, 64);

  const expectedInitiator = toB64(IK_A_pub);
  const derivedInitiator = toB64(IK_A_pub_fromX);
  const expectedResponder = toB64(IK_B.publicKey);
  const derivedResponder = toB64(IK_B_pub_fromX);

  if (expectedInitiator !== derivedInitiator || expectedResponder !== derivedResponder) {
    return null;
  }

  return {
    rootKeyBytes,
    payload: {
      IK_A_header: expectedInitiator,
      IK_A_fromPayload: derivedInitiator,
      IK_B_fromPayload: derivedResponder,
    },
    usedOpkIndex: candidate.index ?? null,
  };
}

export async function performX3DHResponderAndDecrypt(receiverBundle, packet) {
  const indicatedIndex = normalizeOpkIndex(packet.opk_index);
  const candidates = collectPreKeyCandidates(receiverBundle, indicatedIndex);

  for (const candidate of candidates) {
    try {
      const result = await attemptResponderDecryption(receiverBundle, packet, candidate);
      if (result) {
        return {
          ...result,
          resolvedWithFallback: (indicatedIndex ?? null) !== (candidate.index ?? null),
        };
      }
    } catch (err) {
      if (shouldRetryFallback(err)) {
        continue;
      }
      throw err;
    }
  }

  if (indicatedIndex === null) {
    throw new Error('Não foi possível derivar a root key com o material armazenado. Solicite um novo convite.');
  }

  throw new Error(
    'Não foi possível usar a one-time pre-key indicada neste convite. Solicite que o remetente reenvie o compartilhamento.',
  );
}

export async function wrapDataWithRootKey(rootKeyBytes, dataBytes, aadLabel = 'group-key') {
  const aad = encoder.encode(aadLabel);
  const { iv, ciphertext } = await aesGcmEncrypt(rootKeyBytes, dataBytes, aad);
  return { cipher: toB64(ciphertext), iv: toB64(iv), aad: toB64(aad) };
}

export async function unwrapDataWithRootKey(rootKeyBytes, wrapped) {
  const aadBytes = wrapped.aad ? fromB64(wrapped.aad) : new Uint8Array(0);
  const iv = fromB64(wrapped.iv);
  const cipher = fromB64(wrapped.cipher);
  const plain = await aesGcmDecrypt(rootKeyBytes, iv, cipher, aadBytes);
  return plain;
}

export function fingerprintKey(bytes) {
  return toB64(bytes.slice(0, 18));
}
