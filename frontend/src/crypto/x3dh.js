// x3dh.js
// Implementação X3DH (duas fases) para testes no frontend.
// Usa tweetnacl (X25519/Ed25519) + WebCrypto (HKDF + AES-GCM).

import nacl from "tweetnacl";
import { toB64, fromB64, concatUint8Arrays } from "./utils";

// Gera bundle completo (pares privados) — para testes localmente
export function generateBundle(numOpks = 5) {
  const identityKeyBox = nacl.box.keyPair();   // X25519 para ECDH
  const identityKeySign = nacl.sign.keyPair(); // Ed25519 para assinatura
  const signedPreKey = nacl.box.keyPair();     // SPK (X25519)
  const signature = nacl.sign.detached(signedPreKey.publicKey, identityKeySign.secretKey);
  const oneTimePreKeys = Array.from({ length: numOpks }, () => nacl.box.keyPair());

  // estrutura com pares privados (simulação)
  return {
    identityKeyBox,
    identityKeySign,
    signedPreKey,
    signature,
    oneTimePreKeys
  };
}

// Extrai bundle público que iria para o "banco"
export function getPublicBundle(bundle) {
  return {
    identityKeyBox: toB64(bundle.identityKeyBox.publicKey),
    identityKeySign: toB64(bundle.identityKeySign.publicKey),
    signedPreKey: toB64(bundle.signedPreKey.publicKey),
    signature: toB64(bundle.signature),
    oneTimePreKeys: bundle.oneTimePreKeys.map(k => toB64(k.publicKey))
    // Em produção inclua ids/timestamps; aqui simplificamos
  };
}

/* ---------- HKDF -> AES-GCM helpers (WebCrypto) ---------- */

// Deriva uma CryptoKey AES-GCM (256) a partir do input raw (Uint8Array) usando HKDF-SHA256
async function hkdfAesKeyFromInput(rawU8, infoStr = "x3dh", saltU8 = null) {
  const salt = saltU8 ?? new Uint8Array(16); // zeros por padrão para testes
  const info = new TextEncoder().encode(infoStr);

  const master = await crypto.subtle.importKey("raw", rawU8, "HKDF", false, ["deriveKey"]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    master,
    { name: "AES-GCM", length: 256 },
    true, // extractable true para depuração; em prod, preferir false
    ["encrypt", "decrypt"]
  );
  return aesKey;
}

async function aesGcmEncrypt(aesKey, plainU8, aadU8 = null) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aadU8 ?? new Uint8Array(), tagLength: 128 },
    aesKey,
    plainU8
  );
  return { iv: new Uint8Array(iv), ciphertext: new Uint8Array(ct) };
}

async function aesGcmDecrypt(aesKey, ivU8, cipherU8, aadU8 = null) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivU8, additionalData: aadU8 ?? new Uint8Array(), tagLength: 128 },
    aesKey,
    cipherU8
  );
  return new Uint8Array(plain);
}

/* --------------------
   Initiator: Alice
   --------------------
   - verifica assinatura do SPK de Bob
   - gera EK_A
   - calcula DH1..DH4
   - deriva initMsgKey = HKDF(DH2||DH3||DH4)
   - cifra X = (IK_A_pub || IK_B_pub) com initMsgKey
   - deriva rootKey = HKDF(DH1||DH2||DH3||DH4)
   - retorna packet pronto para enviar ao servidor
*/
export async function performX3DHInitiatorAndCreatePacket(initiatorPrivBundle, receiverPublicBundle, chooseOpkIndex = 0) {
  // verificar assinatura do SPK
  const SPK_B_pub = fromB64(receiverPublicBundle.signedPreKey);
  const IKsig_B_pub = fromB64(receiverPublicBundle.identityKeySign);
  const sig = fromB64(receiverPublicBundle.signature);
  if (!nacl.sign.detached.verify(SPK_B_pub, sig, IKsig_B_pub)) {
    throw new Error("Assinatura inválida do SPK do receptor");
  }

  // gerar ephemeral EK_A
  const EK_A = nacl.box.keyPair();

  // decodificar públicos de B
  const IK_B_pub = fromB64(receiverPublicBundle.identityKeyBox);
  const OPK_B_pub = (receiverPublicBundle.oneTimePreKeys && receiverPublicBundle.oneTimePreKeys.length > 0)
    ? fromB64(receiverPublicBundle.oneTimePreKeys[chooseOpkIndex])
    : null;

  // calcular DHs (iniciador)
const IK_A = initiatorPrivBundle.identityKeyBox;
const dh1 = nacl.scalarMult(IK_A.secretKey, SPK_B_pub);    // IK_A_priv * SPK_B_pub
const dh2 = nacl.scalarMult(EK_A.secretKey, IK_B_pub);     // EK_A_priv * IK_B_pub
const dh3 = nacl.scalarMult(EK_A.secretKey, SPK_B_pub);    // EK_A_priv * SPK_B_pub
const dh4 = OPK_B_pub ? nacl.scalarMult(EK_A.secretKey, OPK_B_pub) : new Uint8Array(0);

// ---> agora usamos TODOS os DHs para derivar a chave de cifra do payload X
const all = concatUint8Arrays([dh1, dh2, dh3, dh4]);
// initMsgKey derivada de DH1||DH2||DH3||DH4
const initMsgKey = await hkdfAesKeyFromInput(all, "X3DH init");

// build X = IK_A_pub || IK_B_pub (bytes) ou outro formato
const IK_A_pub_u8 = initiatorPrivBundle.identityKeyBox.publicKey;
const IK_B_pub_u8 = IK_B_pub;
const Xbytes = concatUint8Arrays([IK_A_pub_u8, IK_B_pub_u8]);

// AAD (opcional)
const aadObj = { opk_index: OPK_B_pub ? chooseOpkIndex : null };
const aadU8 = new TextEncoder().encode(JSON.stringify(aadObj));

// cifra X com initMsgKey (que já depende de dh1..dh4)
const { iv, ciphertext } = await aesGcmEncrypt(initMsgKey, Xbytes, aadU8);

// derive rootKey final (pode ser igual ao init key derivado com outro info if you want)
const rootKey = await hkdfAesKeyFromInput(all, "X3DH root");

// montar packet: INCLUIR IK_A_pub em claro (base64)
const packet = {
  EK_A_pub: toB64(EK_A.publicKey),
  IK_A_pub: toB64(IK_A_pub_u8),      // <<< ADICIONADO: identidade pública de Alice em claro 
  //TODO:O backend dar essas informaçoes para a aplicação 
  opk_index: OPK_B_pub ? chooseOpkIndex : null,
  iv: toB64(iv),
  cipher: toB64(ciphertext),
  aad: toB64(aadU8)
};

  return { packet, rootKey, ephemeralKeyPair: EK_A };
}

/* --------------------
   Responder: Bob (duas fases)
   --------------------
   - recebe packet do servidor, e os pares privados de Bob
   - Fase 1: calcula DH2,DH3,DH4 e deriva initMsgKey -> decifra X -> extrai IK_A_pub
   - Fase 2: calcula DH1' com IK_A_pub -> deriva rootKey final
*/
export async function performX3DHResponderAndDecrypt(bobPrivBundle, packet) {
  // trecho a substituir em x3dh.js (performX3DHResponderAndDecrypt)

// 1) decodifica EK_A_pub e (AGORA) IK_A_pub que veio no header
const EK_A_pub_u8 = fromB64(packet.EK_A_pub);
// obter IK_A_pub do header (em claro)
if (!packet.IK_A_pub) {
  throw new Error("Esperava IK_A_pub no header do packet (modo com DH1 enviado)");
}
const IK_A_pub_u8 = fromB64(packet.IK_A_pub);

// 2) selecionar OPK_priv (se informado) - mesmo que antes
let OPK_priv = null;
if (packet.opk_index != null && bobPrivBundle.oneTimePreKeys && bobPrivBundle.oneTimePreKeys.length > packet.opk_index) {
  OPK_priv = bobPrivBundle.oneTimePreKeys[packet.opk_index].secretKey ?? (bobPrivBundle.oneTimePreKeys[packet.opk_index].pair && bobPrivBundle.oneTimePreKeys[packet.opk_index].pair.secretKey);
} else if (bobPrivBundle.oneTimePreKeys && bobPrivBundle.oneTimePreKeys.length) {
  OPK_priv = bobPrivBundle.oneTimePreKeys[0].secretKey ?? (bobPrivBundle.oneTimePreKeys[0].pair && bobPrivBundle.oneTimePreKeys[0].pair.secretKey);
}

// 3) obter IK_B_priv e SPK_B_priv
const IK_B = bobPrivBundle.identityKeyBox;
const SPK_B = bobPrivBundle.signedPreKey;

// 4) calcular DHs — AGORA INCLUINDO dh1
const dh1 = nacl.scalarMult(SPK_B.secretKey, IK_A_pub_u8); // SPK_B_priv * IK_A_pub
const dh2 = nacl.scalarMult(IK_B.secretKey, EK_A_pub_u8);  // IK_B_priv * EK_A_pub
const dh3 = nacl.scalarMult(SPK_B.secretKey, EK_A_pub_u8); // SPK_B_priv * EK_A_pub
const dh4 = OPK_priv ? nacl.scalarMult(OPK_priv, EK_A_pub_u8) : new Uint8Array(0);

// 5) derive initMsgKey = HKDF(DH1||DH2||DH3||DH4)
const all = concatUint8Arrays([dh1, dh2, dh3, dh4]);
const initMsgKey = await hkdfAesKeyFromInput(all, "X3DH init");

// 6) decifrar payload X (com AAD se houver)
const aadU8 = packet.aad ? fromB64(packet.aad) : new Uint8Array(0);
const iv = fromB64(packet.iv);
const cipher = fromB64(packet.cipher);
const plainU8 = await aesGcmDecrypt(initMsgKey, iv, cipher, aadU8);

// 7) extrair IK_A_pub/IK_B_pub do X (se necessário) — já tínhamos IK_A_pub em header
const IK_A_pub_fromX = plainU8.slice(0, 32);
const IK_B_pub_fromX = plainU8.slice(32, 64);

// 8) derivar rootKey final (mesmo all) — ou derive com info="X3DH root"
const rootKey = await hkdfAesKeyFromInput(all, "X3DH root");

// retornar payload e rootKey
return {
  payload: { IK_A_pub_header: toB64(IK_A_pub_u8), IK_A_pub_fromX: toB64(IK_A_pub_fromX), IK_B_pub_fromX: toB64(IK_B_pub_fromX) },
  rootKey,
  used_opk_index: packet.opk_index
};

}
