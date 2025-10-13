// Secure storage for X3DH key material
import { createKeyMaterial } from '@chat-e2e/crypto';
import type { X3DHKeyMaterial, IdentityKeyPair, SignedPreKeyPair, OneTimePreKey } from '@chat-e2e/crypto';

const KEY_MATERIAL_STORAGE_KEY = 'chat-e2e-key-material';

// Serializable format for storage
interface SerializedKeyMaterial {
  identityKey: {
    publicKey: string;        // Base64
    privateKey: string;       // Base64
    signingPublicKey: string; // Base64
    signingPrivateKey: string;// Base64
  };
  signedPreKey: {
    publicKey: string;        // Base64
    privateKey: string;       // Base64
    signature: string;        // Base64
  };
  oneTimePreKeys: Array<{
    id: string;
    publicKey: string;        // Base64
    privateKey: string;       // Base64
  }>;
  createdAt: number;
  lastUsed: number;
}

// Encrypted storage wrapper
interface EncryptedKeyMaterial {
  encryptedData: string;    // Base64 encrypted data
  iv: string;               // Base64 initialization vector
  salt: string;             // Base64 salt for key derivation
  createdAt: number;
}

// Utility functions for base64 conversion
const u8ToB64 = (u8: Uint8Array): string => {
  let s = '';
  u8.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
};

const b64ToU8 = (b64: string): Uint8Array => {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
};

// Derive encryption key from user password
async function deriveEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES key using PBKDF2
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000, // Strong iteration count
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );
}

// Serialize key material to storage format
function serializeKeyMaterial(material: X3DHKeyMaterial): SerializedKeyMaterial {
  return {
    identityKey: {
      publicKey: u8ToB64(material.identityKey.publicKey),
      privateKey: u8ToB64(material.identityKey.privateKey),
      signingPublicKey: u8ToB64(material.identityKey.signingPublicKey),
      signingPrivateKey: u8ToB64(material.identityKey.signingPrivateKey)
    },
    signedPreKey: {
      publicKey: u8ToB64(material.signedPreKey.publicKey),
      privateKey: u8ToB64(material.signedPreKey.privateKey),
      signature: u8ToB64(material.signedPreKey.signature)
    },
    oneTimePreKeys: material.oneTimePreKeys.map(key => ({
      id: key.id,
      publicKey: u8ToB64(key.publicKey),
      privateKey: u8ToB64(key.privateKey)
    })),
    createdAt: Date.now(),
    lastUsed: Date.now()
  };
}

// Deserialize key material from storage format
function deserializeKeyMaterial(serialized: SerializedKeyMaterial): X3DHKeyMaterial {
  return {
    identityKey: {
      publicKey: b64ToU8(serialized.identityKey.publicKey),
      privateKey: b64ToU8(serialized.identityKey.privateKey),
      signingPublicKey: b64ToU8(serialized.identityKey.signingPublicKey),
      signingPrivateKey: b64ToU8(serialized.identityKey.signingPrivateKey)
    },
    signedPreKey: {
      publicKey: b64ToU8(serialized.signedPreKey.publicKey),
      privateKey: b64ToU8(serialized.signedPreKey.privateKey),
      signature: b64ToU8(serialized.signedPreKey.signature)
    },
    oneTimePreKeys: serialized.oneTimePreKeys.map(key => ({
      id: key.id,
      publicKey: b64ToU8(key.publicKey),
      privateKey: b64ToU8(key.privateKey)
    }))
  };
}

// Store key material encrypted with user password
export async function storeKeyMaterial(material: X3DHKeyMaterial, password: string): Promise<boolean> {
  try {
    console.log('🔐 Armazenando material criptográfico com criptografia local...');
    
    // Serialize the key material
    const serialized = serializeKeyMaterial(material);
    const jsonString = JSON.stringify(serialized);
    
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM uses 12-byte IV
    
    // Derive encryption key
    const encryptionKey = await deriveEncryptionKey(password, salt);
    
    // Encrypt the serialized data
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource
      },
      encryptionKey,
      dataBuffer
    );
    
    // Store encrypted data
    const encryptedData: EncryptedKeyMaterial = {
      encryptedData: u8ToB64(new Uint8Array(encryptedBuffer)),
      iv: u8ToB64(iv),
      salt: u8ToB64(salt),
      createdAt: Date.now()
    };
    
    localStorage.setItem(KEY_MATERIAL_STORAGE_KEY, JSON.stringify(encryptedData));
    console.log('✅ Material criptográfico armazenado com segurança');
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao armazenar material criptográfico:', error);
    return false;
  }
}

// Retrieve and decrypt key material using user password
export async function getStoredKeyMaterial(password: string): Promise<X3DHKeyMaterial | null> {
  try {
    console.log('🔓 Carregando material criptográfico armazenado...');
    
    const storedData = localStorage.getItem(KEY_MATERIAL_STORAGE_KEY);
    if (!storedData) {
      console.log('📭 Nenhum material criptográfico encontrado');
      return null;
    }
    
    const encryptedData: EncryptedKeyMaterial = JSON.parse(storedData);
    
    // Reconstruct encryption components
    const salt = b64ToU8(encryptedData.salt);
    const iv = b64ToU8(encryptedData.iv);
    const encrypted = b64ToU8(encryptedData.encryptedData);
    
    // Derive the same encryption key
    const encryptionKey = await deriveEncryptionKey(password, salt);
    
    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource
      },
      encryptionKey,
      encrypted as BufferSource
    );
    
    // Parse the decrypted JSON
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    const serialized: SerializedKeyMaterial = JSON.parse(jsonString);
    
    // Deserialize back to key material
    const material = deserializeKeyMaterial(serialized);
    
    console.log('✅ Material criptográfico carregado com sucesso');
    console.log(`📅 Criado em: ${new Date(serialized.createdAt).toLocaleString()}`);
    console.log(`🔑 Chaves one-time disponíveis: ${material.oneTimePreKeys.length}`);
    
    return material;
    
  } catch (error) {
    console.error('❌ Erro ao carregar material criptográfico:', error);
    console.warn('⚠️ Senha incorreta ou dados corrompidos');
    return null;
  }
}

// Check if key material exists in storage
export function hasStoredKeyMaterial(): boolean {
  return localStorage.getItem(KEY_MATERIAL_STORAGE_KEY) !== null;
}

// Update stored key material (for replenishing one-time keys)
export async function updateStoredKeyMaterial(material: X3DHKeyMaterial, password: string): Promise<boolean> {
  console.log('🔄 Atualizando material criptográfico armazenado...');
  return await storeKeyMaterial(material, password);
}

// Clear stored key material (logout)
export function clearStoredKeyMaterial(): void {
  try {
    localStorage.removeItem(KEY_MATERIAL_STORAGE_KEY);
    console.log('🧹 Material criptográfico removido do armazenamento');
  } catch (error) {
    console.error('❌ Erro ao limpar material criptográfico:', error);
  }
}

// Get key material info without decrypting
export function getKeyMaterialInfo(): { exists: boolean; createdAt?: number } {
  try {
    const storedData = localStorage.getItem(KEY_MATERIAL_STORAGE_KEY);
    if (!storedData) {
      return { exists: false };
    }
    
    const encryptedData: EncryptedKeyMaterial = JSON.parse(storedData);
    return { 
      exists: true, 
      createdAt: encryptedData.createdAt 
    };
  } catch {
    return { exists: false };
  }
}

// Create or restore key material based on storage
export async function getOrCreateKeyMaterial(password: string, oneTimeCount: number = 8): Promise<X3DHKeyMaterial> {
  console.log('🔍 Verificando material criptográfico existente...');
  
  // Try to load existing material
  let material = await getStoredKeyMaterial(password);
  
  if (material) {
    console.log('♻️ Usando material criptográfico existente');
    
    // Check if we need to replenish one-time keys
    if (material.oneTimePreKeys.length < 3) {
      console.log('🔄 Repondo chaves one-time...');
      const newKeys = await import('@chat-e2e/crypto').then(crypto => 
        crypto.generateOneTimePreKeys(oneTimeCount - material!.oneTimePreKeys.length)
      );
      material.oneTimePreKeys.push(...newKeys);
      await updateStoredKeyMaterial(material, password);
    }
  } else {
    console.log('🆕 Criando novo material criptográfico...');
    material = createKeyMaterial(oneTimeCount);
    await storeKeyMaterial(material, password);
  }
  
  return material;
}