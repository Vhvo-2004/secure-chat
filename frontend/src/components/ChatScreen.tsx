import React, { useEffect, useRef, useState } from 'react';
import {
  createKeyMaterial,
  exportBundle,
  encrypt3DESCBC,
  decrypt3DESCBC
} from '@chat-e2e/crypto';
import { ConversationManager } from './ConversationManager.js';
import { 
  getConversationKeys, 
  storeConversationMetadata,
  clearAllStoredData,
  type ConversationKeys 
} from '../utils/conversationStorage.js';
import { 
  getConversationMessages, 
  storeMessage, 
  markConversationAsRead, 
  updateMessageStatus,
  clearAllMessages,
  type StoredMessage 
} from '../utils/messageStorage.js';
import { getOrCreateKeyMaterial, clearStoredKeyMaterial } from '../utils/keyMaterialStorage.js';
import { API_CONFIG } from '../config/api.js';
import { MessageService } from '../services/MessageService.js';

interface ChatScreenProps {
  token: string;
  username: string;
  password: string; // Add password prop for crypto storage
  onLogout: () => void;
}

export function ChatScreen({ token, username, password, onLogout }: ChatScreenProps) {
  const [log, setLog] = useState<string[]>([]);
  const [cryptoLog, setCryptoLog] = useState<string[]>([]);
  const materialRef = useRef<ReturnType<typeof createKeyMaterial> | null>(null);
  const [plain, setPlain] = useState('');
  const [inbox, setInbox] = useState<StoredMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [bundleStatus, setBundleStatus] = useState<'checking' | 'published' | 'missing'>('checking');
  const [showLogoutOptions, setShowLogoutOptions] = useState(false);
  const messageServiceRef = useRef<MessageService | null>(null);

  // Close logout dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showLogoutOptions && !(event.target as Element)?.closest('[data-logout-dropdown]')) {
        setShowLogoutOptions(false);
      }
    }
    
    if (showLogoutOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLogoutOptions]);
  const [activeConversation, setActiveConversation] = useState<{
    id: string;
    otherUser: string;
    keys: ConversationKeys;
  } | null>(null);
  const activeConversationRef = useRef(activeConversation);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const [initializingCrypto, setInitializingCrypto] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Reference for auto-scroll
  
  // Ref for ConversationManager to trigger refresh
  const conversationManagerRef = useRef<{ refreshConversations: () => Promise<void> } | null>(null);
  
  function addLog(message: string) {
    setLog(l => [...l, `${new Date().toLocaleTimeString()}: ${message}`]);
  }

  function addCryptoLog(message: string) {
    setCryptoLog(l => [...l, `${new Date().toLocaleTimeString()}: ${message}`]);
  }

  // Log helper for crypto steps
  function logCryptoStep(title: string, details: Record<string, any>) {
    addCryptoLog(`🔎 ${title}`);
    Object.entries(details).forEach(([k, v]) => {
      if (v instanceof Uint8Array) {
        addCryptoLog(`   ${k}: ${Array.from(v).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      } else {
        addCryptoLog(`   ${k}: ${JSON.stringify(v)}`);
      }
    });
  }

  // Auto-scroll to bottom of messages
  function scrollToBottom() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Handle session finalized notifications
  async function handleSessionFinalized(sessionId: string) {
    addLog(`🔄 Processando notificação de sessão finalizada: ${sessionId}`);
    // Use the global function exposed by ConversationManager
    if ((window as any).handleSessionFinalized) {
      await (window as any).handleSessionFinalized(sessionId);
    } else {
      addLog('⚠️ Handler de sessão finalizada não disponível');
    }
  }

  // Initialize crypto material from stored keys or create new ones
  async function initializeCryptoMaterial(userPassword?: string): Promise<void> {
    try {
      addCryptoLog('🔐 Inicializando material criptográfico...');
      setInitializingCrypto(true);
      
      // Use the login password automatically, fallback to provided password
      const cryptoPassword = userPassword || password;
      
      if (!cryptoPassword) {
        addCryptoLog('❌ Senha não disponível para inicialização criptográfica');
        return;
      }

      const storedMaterial = await getOrCreateKeyMaterial(cryptoPassword);
      
      if (storedMaterial) {
        materialRef.current = storedMaterial;
        addCryptoLog('✅ Material criptográfico restaurado do armazenamento seguro');
        logCryptoStep('Material restaurado', {
          identityPublic: storedMaterial.identityKey.publicKey,
          identityPrivate: storedMaterial.identityKey.privateKey,
          signingPublic: storedMaterial.identityKey.signingPublicKey,
          signingPrivate: storedMaterial.identityKey.signingPrivateKey,
          signedPreKey: storedMaterial.signedPreKey.publicKey,
          signedPreKeySignature: storedMaterial.signedPreKey.signature,
          oneTimePreKeys: storedMaterial.oneTimePreKeys.map(k => k.publicKey)
        });
      } else {
        // Fallback to creating new material
        materialRef.current = createKeyMaterial(8);
        addCryptoLog('⚠️ Criado novo material criptográfico (chaves anteriores podem ser perdidas)');
        logCryptoStep('Material gerado', {
          identityPublic: materialRef.current.identityKey.publicKey,
          identityPrivate: materialRef.current.identityKey.privateKey,
          signingPublic: materialRef.current.identityKey.signingPublicKey,
          signingPrivate: materialRef.current.identityKey.signingPrivateKey,
          signedPreKey: materialRef.current.signedPreKey.publicKey,
          signedPreKeySignature: materialRef.current.signedPreKey.signature,
          oneTimePreKeys: materialRef.current.oneTimePreKeys.map(k => k.publicKey)
        });
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar material criptográfico:', error);
      // Fallback to creating new material
      materialRef.current = createKeyMaterial(8);
      addCryptoLog('⚠️ Erro no armazenamento seguro, criado novo material criptográfico');
    } finally {
      setInitializingCrypto(false);
    }
  }

  // Browser-friendly base64 utils
  const u8ToB64 = (u8: Uint8Array) => {
    let s = '';
    u8.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s);
  };
  
  const b64ToU8 = (b64: string) => {
    const s = atob(b64);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  };

  // Check if user's bundle is published
  async function checkBundleStatus() {
    try {
      addLog('Verificando status do bundle de chaves...');
      addLog(`🔍 Verificando bundle para usuário: ${username}`);
      addLog(`📍 Endpoint: ${API_CONFIG.ENDPOINTS.KEYS_BUNDLE(username)}`);
      
      const res = await fetch(API_CONFIG.ENDPOINTS.KEYS_BUNDLE(username), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      addLog(`📡 Resposta do servidor: ${res.status} ${res.statusText}`);
      
      if (res.ok) {
        const data = await res.json();
        setBundleStatus('published');
        addCryptoLog('✅ Bundle de chaves encontrado no servidor');
        addCryptoLog(`📊 OTPKs disponíveis: ${data.bundle?.oneTimePreKeys?.length || 0}`);
      } else {
        setBundleStatus('missing');
        addCryptoLog('⚠️ Bundle de chaves não encontrado - será necessário publicar');
        if (res.status === 404) {
          addLog('❓ Usuário não possui bundle publicado');
        }
      }
    } catch (error) {
      setBundleStatus('missing');
      addLog(`❌ Erro ao verificar bundle: ${error}`);
    }
  }

  // Publish bundle manually if needed
  async function publishBundleManually() {
    try {
      addCryptoLog('🔐 Publicando bundle de chaves...');
      setBundleStatus('checking');
      
      if (!materialRef.current) {
        addCryptoLog('⚙️ Inicializando material criptográfico...');
        await initializeCryptoMaterial();
      }
      
      if (!materialRef.current) {
        addCryptoLog('❌ Falha ao inicializar material criptográfico');
        setBundleStatus('missing');
        return;
      }
      
      addCryptoLog('📋 Preparando bundle de chaves...');
      const bundle = exportBundle(materialRef.current);
      
      addCryptoLog(`📊 Bundle preparado:`);
      logCryptoStep('Bundle de chaves', {
        identityKey: bundle.identityKey,
        signingPublicKey: bundle.signingPublicKey,
        signedPreKey: bundle.signedPreKey,
        signedPreKeySignature: bundle.signedPreKeySignature,
        oneTimePreKeys: bundle.oneTimePreKeys.map(p => p.key)
      });
      
      const payload = {
        bundle: {
          identityKey: u8ToB64(bundle.identityKey),
          signingPublicKey: bundle.signingPublicKey ? u8ToB64(bundle.signingPublicKey) : undefined,
          signedPreKey: u8ToB64(bundle.signedPreKey),
          signedPreKeySignature: u8ToB64(bundle.signedPreKeySignature),
          oneTimePreKeys: bundle.oneTimePreKeys.map((p: { id: string; key: Uint8Array }) => ({ 
            id: p.id, 
            key: u8ToB64(p.key) 
          }))
        }
      };
      
      addCryptoLog(`📤 Enviando bundle para: ${API_CONFIG.ENDPOINTS.KEYS_PUBLISH}`);
      const res = await fetch(API_CONFIG.ENDPOINTS.KEYS_PUBLISH, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      addCryptoLog(`📡 Resposta da publicação: ${res.status} ${res.statusText}`);
      
      if (res.ok) {
        setBundleStatus('published');
        addCryptoLog('✅ Bundle publicado com sucesso!');
        
        // Re-check bundle status to confirm
        addCryptoLog('🔄 Verificando bundle após publicação...');
        setTimeout(checkBundleStatus, 1000);
      } else {
        setBundleStatus('missing');
        const errorText = await res.text();
        addCryptoLog(`❌ Erro ao publicar bundle: ${res.status} - ${errorText}`);
      }
    } catch (error) {
      setBundleStatus('missing');
      addCryptoLog(`💥 Erro ao publicar bundle: ${error}`);
    }
  }

  // Initialize MessageService
  async function initializeMessageService() {
    try {
      addLog('🚀 Inicializando serviço de mensagens...');
      const messageService = new MessageService(token);
      
      // Set up message callbacks
      messageService.onNewMessage((message) => {
        addLog(`📨 Nova mensagem de ${message.from} na conversa ${message.conversationId}`);
        
        // Use the ref to get the current active conversation
        const currentActiveConvo = activeConversationRef.current;

        // If this is the active conversation, update the inbox state directly
        if (currentActiveConvo && message.conversationId === currentActiveConvo.id) {
          setInbox(prevInbox => {
            // Avoid duplicates
            if (prevInbox.some(m => m.id === message.id)) {
              return prevInbox.map(m => m.id === message.id ? message : m);
            }
            return [...prevInbox, message];
          });
          setTimeout(() => scrollToBottom(), 100);
        }
        
        // Always refresh conversations when a new message is received
        if (conversationManagerRef.current) {
          conversationManagerRef.current.refreshConversations();
        }
      });
      
      // Set up status update callback for conversation list refresh
      messageService.onStatusUpdate((status) => {
        addLog(`📊 Atualizando status de ${status.length} conversas`);
        
        // Refresh conversation list when status updates
        if (conversationManagerRef.current) {
          conversationManagerRef.current.refreshConversations();
        }
      });
      
      // Set up conversation refresh callback for detecting new conversations
      messageService.onConversationRefresh(async () => {
        if (conversationManagerRef.current) {
          await conversationManagerRef.current.refreshConversations();
        }
      });

      // Set up notification callback for real-time updates
      messageService.onNotification(async (notifications) => {
        addLog(`📡 Recebidas ${notifications.length} notificação(ões) do servidor`);
        
        // Process notifications and mark them as read
        const processedNotificationIds = [];
        
        for (const notification of notifications) {
          if (notification.type === 'session_initiated') {
            addLog(`🚀 ${notification.data.message}`);
            // Immediately refresh conversations when session is initiated
            if (conversationManagerRef.current) {
              conversationManagerRef.current.refreshConversations();
            }
          } else if (notification.type === 'session_finalized') {
            addLog(`🔐 ${notification.data.message}`);
            // Process the finalized session directly with the session ID
            if (notification.data.sessionId) {
              addLog('🔄 Forçando atualização de conversas após finalização de sessão...');
              await handleSessionFinalized(notification.data.sessionId);
            }
            // Also refresh conversations list
            if (conversationManagerRef.current) {
              conversationManagerRef.current.refreshConversations();
            }
          } else if (notification.type === 'new_conversation') {
            addLog(`💬 ${notification.data.message}`);
            if (conversationManagerRef.current) {
              conversationManagerRef.current.refreshConversations();
            }
          } else if (notification.type === 'message_received') {
            addLog(`📨 ${notification.data.message}`);
          }
          
          // Track notification ID to mark as read
          processedNotificationIds.push(notification.id);
        }
        
        // Mark all processed notifications as read to prevent duplicates
        try {
          for (const notificationId of processedNotificationIds) {
            await fetch(`${API_CONFIG.BASE_URL}/api/messages/notifications/${notificationId}/read`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`
                // Removed Content-Type since we don't send a body
              }
            });
          }
          addLog(`✅ Marcadas ${processedNotificationIds.length} notificações como lidas`);
        } catch (error) {
          console.error('Erro ao marcar notificações como lidas:', error);
        }
      });
      
      // Start the service
      messageService.start(username);
      messageServiceRef.current = messageService;
      setConnected(true);
      addLog('✅ Serviço de mensagens iniciado');
      
    } catch (error) {
      addLog(`❌ Erro ao inicializar serviço de mensagens: ${error}`);
      setConnected(false);
    }
  }

  // Auto setup on mount
  useEffect(() => {
    const setup = async () => {
      await initializeCryptoMaterial();
    };
    
    setup();
    
    return () => {
      if (messageServiceRef.current) {
        messageServiceRef.current.stop();
      }
    };
  }, [token, password]);

  // Initialize other components when crypto material is ready
  useEffect(() => {
    if (materialRef.current) {
      checkBundleStatus();
      initializeMessageService();
    }
  }, [materialRef.current]);

  // Clear stored data on logout
  function handleLogout() {
    // Close message service
    if (messageServiceRef.current) {
      messageServiceRef.current.stop();
    }
    
    // Clear in-memory state
    setActiveConversation(null);
    setInbox([]);
    setConnected(false);
    materialRef.current = null;
    
    // Call parent logout (clears tokens)
    onLogout();
  }

  // Function to completely clear all user data (for account switching)
  function handleCompleteLogout() {
    clearAllStoredData();
    clearAllMessages();
    clearStoredKeyMaterial();
    handleLogout();
  }

  function handleConversationSelect(conversationId: string, otherUser: string, keys: ConversationKeys) {
    setActiveConversation({ id: conversationId, otherUser, keys });
    addLog(`Conversa ativa: ${otherUser}`);
    
    // Update activity timestamp
    storeConversationMetadata({
      id: conversationId,
      otherUser,
      lastActivity: Date.now()
    });
    
    // Load stored messages for this conversation
    loadStoredMessages(conversationId, otherUser);
    
    // Mark conversation as read
    markConversationAsRead(conversationId);
    
    // Auto-scroll to bottom after loading messages
    setTimeout(() => scrollToBottom(), 100);
  }
  
  function loadStoredMessages(conversationId: string, otherUser: string) {
    try {
      const storedMessages = getConversationMessages(conversationId);
      setInbox(storedMessages);
      addLog(`${storedMessages.length} mensagens carregadas para conversa com ${otherUser}`);
    } catch (error) {
      addLog(`Erro ao carregar mensagens: ${error}`);
      setInbox([]);
    }
  }

  async function sendMessage() {
    if (!activeConversation || !token || !plain.trim() || !messageServiceRef.current) {
      addLog('Selecione uma conversa e digite uma mensagem');
      return;
    }
    
    try {
      addLog(`✉️ Enviando mensagem para ${activeConversation.otherUser}...`);
      // Exemplo de log de criptografia (simulação)
      const keys = activeConversation.keys;
      logCryptoStep(`Criptografia 3DES para -> ${activeConversation.otherUser}`, {
        encKey: keys.encKey,
        macKey: keys.macKey,
        plainText: plain
      });
      // Aqui você pode adicionar logs reais do resultado da encrypt3DESCBC se desejar
      await messageServiceRef.current.sendMessage(
        activeConversation.id,
        plain,
        activeConversation.otherUser
      );
      setPlain('');
      addLog(`✅ Mensagem enviada para ${activeConversation.otherUser}`);
    } catch (error) {
      addLog(`❌ Erro ao enviar mensagem: ${error}`);
    }
  }

  return (
    <div style={{ 
      fontFamily: 'sans-serif', 
      padding: '1rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Password Input for Crypto Initialization - REMOVED: Now using login password automatically */}
      {/* {needsPassword && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0 }}>🔐 Acesso às Chaves Criptográficas</h3>
            <p>Digite sua senha para acessar suas chaves privadas armazenadas:</p>
            <input
              type="password"
              placeholder="Senha"
              value={cryptoPassword}
              onChange={(e) => setCryptoPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              style={{
                width: '100%',
                padding: '0.5rem',
                marginBottom: '1rem',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handlePasswordSubmit}
                disabled={initializingCrypto}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: initializingCrypto ? 'wait' : 'pointer'
                }}
              >
                {initializingCrypto ? 'Inicializando...' : 'Acessar'}
              </button>
              <button
                onClick={() => {
                  setNeedsPassword(false);
                  materialRef.current = createKeyMaterial(8);
                  addLog('⚠️ Usando chaves temporárias (sem persistência)');
                  checkBundleStatus();
                  // Removido: WebSocket não utilizado
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Pular (Temporário)
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#333' }}>Chat E2E</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
            Conectado como: <strong>{username}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>          
          <div style={{ position: 'relative' }} data-logout-dropdown>
            <button
              onClick={() => setShowLogoutOptions(!showLogoutOptions)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Sair ▼
            </button>
            
            {showLogoutOptions && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                minWidth: '200px'
              }}>
                <button
                  onClick={() => {
                    handleLogout();
                    setShowLogoutOptions(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    Logout Normal
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Mantém mensagens e conversas
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    if (confirm('Tem certeza? Isso apagará TODAS as suas mensagens e chaves criptográficas. Esta ação não pode ser desfeita.')) {
                      handleCompleteLogout();
                      setShowLogoutOptions(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffe6e6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: '#dc3545' }}>
                    Logout Completo
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Apaga tudo (mensagens + chaves)
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', height: 'calc(100vh - 120px)' }}>
        {/* Left Panel - Conversations and Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Conversation Manager */}
          <div style={{ flex: 1 }}>
            <ConversationManager
              ref={conversationManagerRef}
              token={token}
              username={username}
              currentMaterial={materialRef.current}
              onConversationSelect={handleConversationSelect}
              onLog={addLog}
              onCryptoLog={addCryptoLog}
              onSessionFinalized={handleSessionFinalized}
            />
          </div>
        </div>

        {/* Chat Panel */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '1rem', 
            borderBottom: '1px solid #eee',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px 8px 0 0'
          }}>
            <h2 style={{ 
              margin: 0, 
              color: '#333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                {activeConversation ? `Chat com ${activeConversation.otherUser}` : 'Selecione uma conversa'}
              </span>
              {activeConversation && (
                <span style={{
                  fontSize: '0.7rem',
                  color: '#28a745',
                  backgroundColor: '#d4edda',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  🔐 Criptografado
                </span>
              )}
            </h2>
          </div>
          
          <div style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            backgroundColor: '#f8f9fa',
            minHeight: '300px'
          }}>
            {!activeConversation ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗨️</div>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Bem-vindo ao Chat E2E</h3>
                <p style={{ margin: 0 }}>
                  Selecione uma conversa existente ou crie uma nova<br/>
                  para começar a trocar mensagens criptografadas
                </p>
              </div>
            ) : inbox.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
                <p style={{ margin: 0 }}>
                  Conversa segura estabelecida com {activeConversation.otherUser}<br/>
                  Digite uma mensagem abaixo para começar
                </p>
              </div>
            ) : (
              <div>
                {inbox.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: msg.direction === 'sent' ? '#e3f2fd' : 'white',
                      borderRadius: '8px',
                      border: '1px solid #eee',
                      maxWidth: '80%',
                      marginLeft: msg.direction === 'sent' ? 'auto' : '0',
                      marginRight: msg.direction === 'sent' ? '0' : 'auto'
                    }}
                  >
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#666',
                      marginBottom: '0.25rem'
                    }}>
                      {msg.direction === 'sent' ? 'Você' : msg.from}
                    </div>
                    <div>{msg.content}</div>
                  </div>
                ))}
                {/* Invisible element for auto-scrolling */}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          <div style={{
            padding: '1rem',
            borderTop: '1px solid #eee',
            backgroundColor: 'white',
            borderRadius: '0 0 8px 8px'
          }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                placeholder={activeConversation ? "Digite sua mensagem..." : "Selecione uma conversa primeiro"}
                value={plain}
                onChange={(e) => setPlain(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && activeConversation) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
                disabled={!activeConversation}
              />
              <button
                disabled={!activeConversation || !plain.trim()}
                onClick={sendMessage}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  opacity: (!activeConversation || !plain.trim()) ? 0.6 : 1
                }}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Log */}
      <div style={{
        marginTop: '2rem',
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, color: '#333' }}>Log de Criptografia</h2>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '1rem',
          borderRadius: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        }}>
          {cryptoLog.length === 0 ? (
            <p style={{ margin: 0, color: '#666' }}>Nenhuma atividade de criptografia ainda</p>
          ) : (
            cryptoLog.map((entry, i) => (
              <div key={i} style={{ marginBottom: '0.25rem' }}>
                {entry}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}