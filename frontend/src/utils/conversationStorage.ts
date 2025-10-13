// Utility for managing conversation keys in localStorage
export interface ConversationKeys {
  encKey: Uint8Array;
  macKey: Uint8Array;
  derivedAt: number;
  sessionId?: string;
}

export interface StoredConversation {
  id: string;
  otherUser: string;
  keys?: ConversationKeys;
  lastActivity: number;
}

const STORAGE_KEY = 'chat-e2e-conversations';
const KEYS_STORAGE_KEY = 'chat-e2e-keys';

// Utility functions for base64 conversion
export const u8ToB64 = (u8: Uint8Array): string => {
  let s = '';
  u8.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
};

export const b64ToU8 = (b64: string): Uint8Array => {
  console.log('🔬 b64ToU8 CHAMADA com valor:', b64);
  if (typeof b64 !== 'string' || !b64.length) {
    console.error('b64ToU8: valor não é string ou está vazio:', b64);
    return new Uint8Array(0);
  }
  // Remove whitespace and convert base64url to base64 if needed
  let safeB64 = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' if necessary
  while (safeB64.length % 4 !== 0) safeB64 += '=';
  console.log('🔬 b64ToU8 após normalização:', safeB64);
  try {
    if (typeof atob === 'function') {
      // Browser
      console.log('b64ToU8: tentando decodificar:', safeB64);
      const s = atob(safeB64);
      console.log('b64ToU8: string decodificada length:', s.length);
      const u8 = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
      console.log('b64ToU8: resultado length:', u8.length, 'primeiros bytes:', Array.from(u8.slice(0, 8)));
      return u8;
    } else {
      // Node.js: instrução para dev
      console.error('b64ToU8: ambiente Node detectado, use Buffer.from(base64, "base64") para decodificar.');
      return new Uint8Array(0);
    }
  } catch (e) {
    console.error('Erro ao decodificar base64:', b64, e);
    return new Uint8Array(0);
  }
};

// Store conversation keys securely in localStorage
export function storeConversationKeys(conversationId: string, keys: ConversationKeys): void {
  try {
    const stored = getStoredKeys();
    stored[conversationId] = {
      encKey: u8ToB64(keys.encKey),
      macKey: u8ToB64(keys.macKey),
      derivedAt: keys.derivedAt,
      sessionId: keys.sessionId
    };
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('Failed to store conversation keys:', error);
  }
}

// Retrieve conversation keys from localStorage
export function getConversationKeys(conversationId: string): ConversationKeys | null {
  try {
    const stored = getStoredKeys();
    const keyData = stored[conversationId];
    if (!keyData) return null;
    
    return {
      encKey: b64ToU8(keyData.encKey),
      macKey: b64ToU8(keyData.macKey),
      derivedAt: keyData.derivedAt,
      sessionId: keyData.sessionId
    };
  } catch (error) {
    console.error('Failed to retrieve conversation keys:', error);
    return null;
  }
}

// Get all stored keys (internal format)
function getStoredKeys(): Record<string, any> {
  try {
    const stored = localStorage.getItem(KEYS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Store conversation metadata
export function storeConversationMetadata(conversation: StoredConversation): void {
  try {
    const stored = getStoredConversations();
    stored[conversation.id] = {
      id: conversation.id,
      otherUser: conversation.otherUser,
      lastActivity: conversation.lastActivity
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('Failed to store conversation metadata:', error);
  }
}

// Get conversation metadata
export function getStoredConversations(): Record<string, StoredConversation> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Remove conversation and its keys
export function removeConversation(conversationId: string): void {
  try {
    // Remove metadata
    const conversations = getStoredConversations();
    delete conversations[conversationId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    
    // Remove keys
    const keys = getStoredKeys();
    delete keys[conversationId];
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (error) {
    console.error('Failed to remove conversation:', error);
  }
}

// Clear all stored data (logout)
export function clearAllStoredData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(KEYS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear stored data:', error);
  }
}