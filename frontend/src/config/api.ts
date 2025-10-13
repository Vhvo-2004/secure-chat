// API Configuration - centralized endpoint management
let API_BASE_URL = 'http://localhost:3000';

export const API_CONFIG = {
  get BASE_URL() { return API_BASE_URL; },
  // Removido: WebSocket não utilizado
  
  // API Endpoints
  get ENDPOINTS() {
    return {
      // Auth
      REGISTER: `${API_BASE_URL}/auth/register`,
      LOGIN: `${API_BASE_URL}/auth/login`,
      
      // Keys
      KEYS_PUBLISH: `${API_BASE_URL}/keys/publish`,
      KEYS_BUNDLE: (username: string) => `${API_BASE_URL}/keys/${username}/bundle`,
      
      // Conversations
      CONVERSATIONS: `${API_BASE_URL}/conversations`,
      CONVERSATIONS_START: `${API_BASE_URL}/conversations/start`,
      CONVERSATIONS_WITH: (username: string) => `${API_BASE_URL}/conversations/with/${username}`,
      
      // Sessions
      SESSIONS_INITIATE: `${API_BASE_URL}/sessions/initiate`,
      SESSIONS_FINALIZE: (sessionId: string) => `${API_BASE_URL}/sessions/${sessionId}/finalize`,
      SESSIONS_GET: (sessionId: string) => `${API_BASE_URL}/sessions/${sessionId}`,
      SESSIONS_PENDING: (username: string) => `${API_BASE_URL}/sessions/pending/${username}`,
      
      // Messages (REST only)
      MESSAGES_SEND: `${API_BASE_URL}/api/messages/send`,
      MESSAGES_SYNC: `${API_BASE_URL}/api/messages/sync`,
      MESSAGES_MARK_READ: `${API_BASE_URL}/api/messages/mark-read`,
      MESSAGES_CONVERSATIONS_STATUS: `${API_BASE_URL}/api/messages/conversations/status`,
      MESSAGES_CONVERSATION_HISTORY: (conversationId: string) => `${API_BASE_URL}/api/messages/conversations/${conversationId}/history`
    };
  }
};

// Auto-detect backend port from known possible ports
export async function detectBackendPort(): Promise<string> {
  const possiblePorts = [3000, 3001, 3002, 3003, 3004];
  
  console.log('🔍 Iniciando detecção automática do backend...');
  
  for (const port of possiblePorts) {
    try {
      console.log(`🌐 Testando porta ${port}...`);
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        timeout: 1000
      } as any);
      
      if (response.ok) {
        const baseUrl = `http://localhost:${port}`;
        console.log(`✅ Backend detectado na porta ${port}: ${baseUrl}`);
        return baseUrl;
      } else {
        console.log(`❌ Porta ${port}: resposta ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Porta ${port}: erro de conexão`);
    }
  }
  
  console.warn('⚠️ Backend auto-detection failed, using default port 3000');
  return 'http://localhost:3000';
}

// Update API config with detected backend
export async function initializeApiConfig(): Promise<void> {
  console.log('🚀 Inicializando configuração da API...');
  const detectedUrl = await detectBackendPort();
  API_BASE_URL = detectedUrl;
  console.log(`🔧 API configurada para ${detectedUrl}`);
  console.log('📋 Endpoints disponíveis:', {
    register: API_CONFIG.ENDPOINTS.REGISTER,
    login: API_CONFIG.ENDPOINTS.LOGIN,
    keysPublish: API_CONFIG.ENDPOINTS.KEYS_PUBLISH,
    messagesSync: API_CONFIG.ENDPOINTS.MESSAGES_SYNC
  });
}