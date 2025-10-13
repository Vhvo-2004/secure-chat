// Tipagem global para evitar erro do window._checkedPendingSessions
declare global {
  interface Window {
    _checkedPendingSessions?: Set<string>;
  }
}
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  storeConversationKeys,
  getConversationKeys,
  storeConversationMetadata,
  getStoredConversations,
  u8ToB64,
  b64ToU8,
  type ConversationKeys
} from '../utils/conversationStorage.js';
import {
  getConversationSummary,
  type StoredMessage
} from '../utils/messageStorage.js';
import {
  createKeyMaterial,
  exportBundle,
  generateIdentityKeyPair,
  initiatorDeriveSharedSecret,
  responderDeriveSharedSecret,
  verifySignedPreKey
} from '@chat-e2e/crypto';
import { API_CONFIG } from '../config/api.js';

interface Conversation {
  id: string;
  other_user: string;
  created_at: string;
  hasKeys?: boolean;
  lastActivity?: number;
  messageSummary?: {
    lastMessage?: StoredMessage;
    totalMessages: number;
    unreadCount: number;
  };
}

interface ConversationManagerProps {
  token: string;
  username: string;
  currentMaterial: ReturnType<typeof createKeyMaterial> | null;
  onConversationSelect: (conversationId: string, otherUser: string, keys: ConversationKeys) => void;
  onLog: (message: string) => void;
  onCryptoLog?: (message: string) => void;
  onSessionFinalized?: (sessionId: string) => void;
}

export const ConversationManager = forwardRef<
  { refreshConversations: () => Promise<void> },
  ConversationManagerProps
>(function ConversationManager({ 
  token, 
  username, 
  currentMaterial, 
  onConversationSelect, 
  onLog,
  onCryptoLog,
  onSessionFinalized
}, ref) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [newChatUser, setNewChatUser] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);

  // Expose refreshConversations function to parent component
  useImperativeHandle(ref, () => ({
    refreshConversations: async () => {
      onLog('🔄 Atualizando conversas via notificação do servidor...');
      await loadConversations();
      // Check for pending sessions only when explicitly requested (via notifications)
      await checkPendingSessionsForConversations(conversations);
    }
  }), [token, currentMaterial, conversations]);

  // Load conversations on component mount
  useEffect(() => {
    loadConversations();
  }, [token]);

  async function loadConversations() {
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await fetch(API_CONFIG.ENDPOINTS.CONVERSATIONS, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const stored = getStoredConversations();
        
        // Merge server data with local storage
        const enrichedConversations = data.conversations.map((conv: any) => {
          const messageSummary = getConversationSummary(conv.id);
          return {
            ...conv,
            hasKeys: !!getConversationKeys(conv.id),
            lastActivity: stored[conv.id]?.lastActivity || new Date(conv.created_at).getTime(),
            messageSummary
          };
        });
        
        setConversations(enrichedConversations);
        onLog(`Carregadas ${enrichedConversations.length} conversas`);
        
        // Check for pending sessions for conversations without keys
        await checkPendingSessionsForConversations(enrichedConversations);
        
      } else {
        onLog(`Erro ao carregar conversas: ${res.status}`);
      }
    } catch (error) {
      onLog(`Erro de conexão ao carregar conversas: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  async function checkPendingSessionsForConversations(conversations: Conversation[]) {
    if (!currentMaterial) {
      onLog(`⚠️ Material criptográfico não disponível para verificar sessões`);
      return;
    }
    
    // Find conversations without keys
    const conversationsWithoutKeys = conversations.filter(conv => !conv.hasKeys);
    
    if (conversationsWithoutKeys.length > 0) {
      onLog(`🔍 Verificando automaticamente ${conversationsWithoutKeys.length} conversas sem chaves...`);
      
      let foundPendingSessions = false;
      
      for (const conv of conversationsWithoutKeys) {
        try {
          onLog(`📡 Verificando sessão pendente para ${conv.other_user}...`);
          
          // Check if there's a pending session from this user
          const pendingSessionRes = await fetch(API_CONFIG.ENDPOINTS.SESSIONS_PENDING(conv.other_user), {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (pendingSessionRes.ok) {
            onLog(`✅ Sessão X3DH pendente encontrada para ${conv.other_user}!`);
            onLog(`🔄 Estabelecendo chaves automaticamente...`);
            
            const sessionData = await pendingSessionRes.json();
            
            // Respond to the X3DH and establish keys
            const keys = await respondToX3DH(sessionData, conv.id);
            
            // Store keys and metadata
            storeConversationKeys(conv.id, keys);
            storeConversationMetadata({
              id: conv.id,
              otherUser: conv.other_user,
              lastActivity: Date.now()
            });

            onLog(`🔐 Chaves estabelecidas automaticamente para ${conv.other_user}`);
            onLog(`💬 Conversa com ${conv.other_user} agora está pronta para mensagens!`);
            foundPendingSessions = true;
            
          } else if (pendingSessionRes.status === 404) {
            onLog(`ℹ️ Nenhuma sessão pendente para ${conv.other_user}`);
          } else {
            onLog(`⚠️ Erro ${pendingSessionRes.status} ao verificar ${conv.other_user}`);
          }
        } catch (error) {
          onLog(`❌ Erro ao verificar sessão para ${conv.other_user}: ${error}`);
        }
      }
      
      // Reload conversations to update key status if we found any pending sessions
      if (foundPendingSessions) {
        onLog(`🔄 Recarregando lista de conversas com chaves atualizadas...`);
        // Small delay to allow key storage to complete
        setTimeout(() => {
          loadConversations();
        }, 1500);
      } else {
        onLog(`ℹ️ Nenhuma sessão pendente encontrada no momento`);
      }
    } else {
      onLog(`✅ Todas as conversas já possuem chaves estabelecidas`);
    }
  }

  async function createNewConversation() {
    if (!newChatUser.trim() || !token || !currentMaterial) {
      onLog('Preencha o nome do usuário e publique seu bundle primeiro');
      return;
    }

    if (newChatUser.trim() === username) {
      onLog('Você não pode criar uma conversa consigo mesmo');
      return;
    }

    setCreatingChat(true);
    onLog(`Iniciando conversa com ${newChatUser}...`);

    try {
      // v1.3 Enhancement: Pre-validate target user existence
      // This prevents confusing 500 errors and provides immediate feedback
      onLog(`Verificando se usuário "${newChatUser}" existe...`);
      const userCheckRes = await fetch(API_CONFIG.ENDPOINTS.KEYS_BUNDLE(newChatUser), {
        method: 'HEAD', // Apenas para verificar se existe, sem baixar dados
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!userCheckRes.ok) {
        if (userCheckRes.status === 404) {
          onLog(`❌ Usuário "${newChatUser}" não foi encontrado ou não possui chaves publicadas`);
          onLog(`💡 Certifique-se de que "${newChatUser}" fez registro e login pelo menos uma vez`);
          setCreatingChat(false);
          return;
        }
      }
      onLog(`✅ Usuário "${newChatUser}" encontrado`);

      // 1. Check if conversation already exists
      let conversationId: string | undefined;
      let keys: ConversationKeys | undefined;

      // Busca conversa existente
      const existingRes = await fetch(API_CONFIG.ENDPOINTS.CONVERSATIONS_WITH(newChatUser), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (existingRes.ok) {
        const existingData = await existingRes.json();
        conversationId = existingData.id;
        if (conversationId) {
          const existingKeys = getConversationKeys(conversationId);
          if (existingKeys) {
            onLog('Chaves já existem para esta conversa');
            onConversationSelect(conversationId, newChatUser, existingKeys);
            setNewChatUser('');
            setCreatingChat(false);
            await loadConversations();
            return;
          }
        }
      } else {
        // Se não existe, backend irá criar ao iniciar X3DH
        conversationId = undefined;
      }

      // 2. Iniciar handshake X3DH
      onLog('Iniciando novo handshake X3DH...');
      // Passe string vazia se conversationId for undefined
      keys = await initiateX3DH(newChatUser, conversationId || '');

      // 3. Store keys and metadata
      if ((!conversationId || conversationId === '') && keys && keys.sessionId) {
        // Se o backend retorna conversationId via sessionId, use
        conversationId = keys.sessionId;
      }
      if (!conversationId || conversationId === '') {
        onLog('Erro: conversationId não definido após handshake');
        setCreatingChat(false);
        return;
      }
      
      storeConversationKeys(conversationId, keys);
      storeConversationMetadata({
        id: conversationId,
        otherUser: newChatUser,
        lastActivity: Date.now()
      });

      onLog(`X3DH concluído com sucesso para ${newChatUser}`);
      onConversationSelect(conversationId, newChatUser, keys);
      setNewChatUser('');
      await loadConversations();

    } catch (error: any) {
      // v1.3 Enhancement: Comprehensive error handling with specific user messages
      // Provides clear feedback for different error scenarios instead of generic messages
      let errorMessage = 'Erro desconhecido ao criar conversa';
      
      if (error.message) {
        if (error.message.includes('Bundle não encontrado')) {
          errorMessage = `Usuário "${newChatUser}" não encontrado ou não possui chaves publicadas. Verifique se o usuário está registrado.`;
        } else if (error.message.includes('Erro ao iniciar sessão: 404')) {
          errorMessage = `Usuário "${newChatUser}" não foi encontrado no sistema. Certifique-se de que o usuário está registrado.`;
        } else if (error.message.includes('Erro ao iniciar sessão: 500')) {
          errorMessage = `Erro interno do servidor ao iniciar conversa com "${newChatUser}". Tente novamente.`;
        } else if (error.message.includes('recipient_not_found')) {
          errorMessage = `Usuário "${newChatUser}" não existe. Registre este usuário primeiro.`;
        } else if (error.message.includes('recipient_no_bundle')) {
          errorMessage = `Usuário "${newChatUser}" existe mas não publicou suas chaves criptográficas. Peça para o usuário fazer login primeiro.`;
        } else {
          errorMessage = `Erro ao criar conversa: ${error.message}`;
        }
      }
      
      onLog(`❌ ${errorMessage}`);
      console.error('Detalhes do erro:', error);
    } finally {
      setCreatingChat(false);
    }
  }

  function logCryptoStep(title: string, details: Record<string, any>) {
    const logFunc = onCryptoLog || onLog;
    logFunc(`🔎 ${title}`);
    Object.entries(details).forEach(([k, v]) => {
      if (v instanceof Uint8Array) {
        logFunc(`   ${k}: ${Array.from(v).map((b: number) => b.toString(16).padStart(2, '0')).join(' ')}`);
      } else if (Array.isArray(v) && v.length && v[0] instanceof Uint8Array) {
        logFunc(`   ${k}: [${v.map((arr: Uint8Array) => Array.from(arr).map((b: number) => b.toString(16).padStart(2, '0')).join(' ')).join('; ')}]`);
      } else {
        logFunc(`   ${k}: ${JSON.stringify(v)}`);
      }
    });
  }

  async function respondToX3DH(sessionData: any, conversationId: string): Promise<ConversationKeys> {
    if (!currentMaterial) throw new Error('Material criptográfico não disponível');

    const initiatorName = sessionData.initiator || 'desconhecido';
    onLog(`🔄 Respondendo ao X3DH para conversa ${conversationId} com ${initiatorName}`);
    onLog(`📋 Session data: ${JSON.stringify(sessionData, null, 2)}`);
    onLog(`🔑 One-time keys disponíveis: ${currentMaterial.oneTimePreKeys.length}`);
  onLog(`🔑 One-time keys disponíveis: ${currentMaterial.oneTimePreKeys.length}`);
  const otpkId = sessionData.oneTimePreKey && typeof sessionData.oneTimePreKey.id === 'string' ? sessionData.oneTimePreKey.id : '';
  onLog(`🎯 Procurando one-time key: ${otpkId}`);

  let selectedOTK = currentMaterial.oneTimePreKeys.find(k => k.id === otpkId);
    if (!selectedOTK && otpkId.includes(':')) {
      // If session ID has prefix (e.g., "Bob:otpk-0"), try matching without prefix
      const shortId = otpkId.split(':')[1]; // Extract 'otpk-0' from 'Bob:otpk-0'
      onLog(`🔄 Tentando buscar one-time key com ID curto: ${shortId}`);
      selectedOTK = currentMaterial.oneTimePreKeys.find(k => k.id === shortId);
    }
    if (!selectedOTK) {
      onLog(`❌ Erro crítico: One-time key ${otpkId} não encontrada no material local de Bob`);
      onLog(`🔑 One-time keys disponíveis: ${currentMaterial.oneTimePreKeys.map(k => k.id).join(', ')}`);
      throw new Error(`One-time key ${otpkId} não encontrada no material criptográfico local`);
    }
    onLog(`✅ One-time key encontrada localmente: ${selectedOTK.id}`);

    onLog(`🔬 sessionData.initiatorIdentityKey: ${sessionData.initiatorIdentityKey}`);
    onLog(`🔬 sessionData.initiatorEphemeralKey: ${sessionData.initiatorEphemeralKey}`);

    const result = responderDeriveSharedSecret({
      receiverIdentityKey: currentMaterial.identityKey,
      receiverSignedPreKey: currentMaterial.signedPreKey,
      receiverOneTimePreKey: selectedOTK,
      senderIdentityKey: b64ToU8(sessionData.initiatorIdentityKey),
      senderEphemeralKey: b64ToU8(sessionData.initiatorEphemeralKey)
    });

    logCryptoStep(`X3DH (Responder) para <- ${initiatorName}`, {
      'Componentes DH (HKDF Input)': result.info.dhParts,
      'Chave de Criptografia (encKey)': result.encKey,
      'Chave de Autenticação (macKey)': result.macKey,
    });

    return {
      encKey: result.encKey,
      macKey: result.macKey,
      derivedAt: Date.now(),
      sessionId: sessionData.sessionId
    };
  }

  async function initiateX3DH(targetUser: string, conversationId: string): Promise<ConversationKeys> {
    if (!currentMaterial) throw new Error('Material criptográfico não disponível');

    try {
      // 1. Get target user's bundle
      const bundleRes = await fetch(API_CONFIG.ENDPOINTS.KEYS_BUNDLE(targetUser), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!bundleRes.ok) {
        if (bundleRes.status === 404) {
          throw new Error(`Bundle não encontrado para ${targetUser} (usuário não registrado ou sem chaves)`);
        }
        throw new Error(`Erro ${bundleRes.status} ao buscar bundle para ${targetUser}`);
      }

    const bundleData = await bundleRes.json();
    const bundle = bundleData.bundle;

    // 2. Verify signed prekey if signature available
    if (bundle.signingPublicKey) {
      const isValid = verifySignedPreKey(
        b64ToU8(bundle.signingPublicKey),
        b64ToU8(bundle.signedPreKey),
        b64ToU8(bundle.signedPreKeySignature)
      );
      onLog(`Verificação da chave pré-assinada: ${isValid ? 'válida' : 'inválida'}`);
      logCryptoStep(`Verificação da assinatura para -> ${targetUser}`, {
        signingPublicKey: b64ToU8(bundle.signingPublicKey),
        signedPreKey: b64ToU8(bundle.signedPreKey),
        signedPreKeySignature: b64ToU8(bundle.signedPreKeySignature),
        resultado: isValid
      });
    }

    // Generate unique ephemeral key pair for this session
    const ephemeralKeyPair = generateIdentityKeyPair();
    
    // 3. Initiate session with initiator keys
    const sessionRes = await fetch(API_CONFIG.ENDPOINTS.SESSIONS_INITIATE, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        to: targetUser, 
        conversationId,
        initiatorIdentityKey: u8ToB64(currentMaterial.identityKey.publicKey),
        initiatorEphemeralKey: u8ToB64(ephemeralKeyPair.publicKey) // Use unique ephemeral key
      })
    });

    if (!sessionRes.ok) {
      throw new Error(`Erro ao iniciar sessão: ${sessionRes.status}`);
    }

    const sessionData = await sessionRes.json();
    const rcv = sessionData.session.recipientBundle;

    onLog(`🔄 Iniciando derivação de chaves como iniciador`);
    onLog(`📋 Recipient bundle: ${JSON.stringify(rcv, null, 2)}`);
    onLog(`🔑 Using one-time key: ${rcv.oneTimePreKey?.id || 'NONE'}`);

    const result = initiatorDeriveSharedSecret({
      senderIdentityKey: currentMaterial.identityKey,
      senderEphemeralKey: ephemeralKeyPair, // Use the generated ephemeral key
      receiverIdentityKey: b64ToU8(rcv.identityKey),
      receiverSignedPreKey: b64ToU8(rcv.signedPreKey),
      receiverSignedPreKeySignature: b64ToU8(rcv.signedPreKeySignature),
      receiverOneTimePreKey: rcv.oneTimePreKey ? { id: rcv.oneTimePreKey.id, key: b64ToU8(rcv.oneTimePreKey.key) } : undefined
    });

    logCryptoStep(`X3DH (Iniciador) para -> ${targetUser}`, {
      'Componentes DH (HKDF Input)': result.info.dhParts,
      'Chave de Criptografia (encKey)': result.encKey,
      'Chave de Autenticação (macKey)': result.macKey,
    });

    return {
      encKey: result.encKey,
      macKey: result.macKey,
      derivedAt: Date.now(),
      sessionId: sessionData.session.conversationId // Use conversationId instead of sessionId
    };
    } catch (error: any) {
      // Re-throw with more context for the outer catch block
      if (error.message) {
        throw error; // Preserve original error message
      }
      throw new Error(`Erro no handshake X3DH: ${error}`);
    }
  }

  async function handleSessionFinalized(sessionId: string): Promise<void> {
    try {
      if (!currentMaterial) {
        onLog('❌ Material criptográfico não disponível para derivar chaves de receptor');
        return;
      }

      onLog(`🔄 Processando sessão finalizada: ${sessionId}`);

      // Get session details from server
      const sessionRes = await fetch(API_CONFIG.ENDPOINTS.SESSIONS_GET(sessionId), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!sessionRes.ok) {
        onLog(`❌ Erro ao buscar detalhes da sessão ${sessionId}: ${sessionRes.status}`);
        return;
      }

      const sessionData = await sessionRes.json();
      const session = sessionData.session;
      
      onLog(`📄 Detalhes da sessão: de ${session.initiator} para ${session.recipient}`);

      // Check if we are the recipient
      if (session.recipient !== username) {
        onLog(`⚠️ Sessão não é para este usuário (${username}), ignorando`);
        return;
      }

      // Derive shared secret as recipient
      onLog(`🔄 Iniciando derivação de chaves como receptor`);
      onLog(`📋 Session details: ${JSON.stringify(session, null, 2)}`);
      onLog(`🔑 Using one-time key: ${session.oneTimePreKey?.id || 'NONE'}`);
      onLog(`🔑 Received ephemeral key: ${session.initiatorEphemeralKey?.substring(0, 16)}...`);
      
      // Use the one-time key from the session (which includes the public key)
      // instead of searching in local material (which may be out of sync)
      let usedOTK = undefined;
      if (session.oneTimePreKey) {
        onLog(`🔍 Available local OTKs: ${currentMaterial.oneTimePreKeys.map(otk => otk.id).join(', ')}`);
        
        // Find the corresponding private key in local material
        const localOTK = currentMaterial.oneTimePreKeys.find(otk => {
          // Try exact match first
          if (otk.id === session.oneTimePreKey.id) return true;
          
          // If session ID has prefix (e.g., "Bob:otpk-0"), try matching without prefix
          if (session.oneTimePreKey.id.includes(':')) {
            const shortId = session.oneTimePreKey.id.split(':')[1]; // Extract 'otpk-0' from 'Bob:otpk-0'
            return otk.id === shortId;
          }
          
          return false;
        });
        
        if (localOTK) {
          usedOTK = {
            id: session.oneTimePreKey.id,
            publicKey: b64ToU8(session.oneTimePreKey.key),
            privateKey: localOTK.privateKey
          };
          onLog(`✅ One-time key found in local material (matched ${localOTK.id})`);
        } else {
          onLog(`⚠️ One-time key ${session.oneTimePreKey.id} not found in local material`);
          onLog(`💡 This might happen if the material was regenerated. Continuing without OTK.`);
          // Continue without OTK for now
        }
      }
      
      // Log all DH parameters for comparison  
      onLog(`🔍 Responder DH parameters:`);
      onLog(`  - Bob IK: ${u8ToB64(currentMaterial.identityKey.publicKey).substring(0, 16)}...`);
      onLog(`  - Bob SPK: ${u8ToB64(currentMaterial.signedPreKey.publicKey).substring(0, 16)}...`);
      onLog(`  - Bob OTK: ${usedOTK ? u8ToB64(usedOTK.publicKey).substring(0, 16) + '...' : 'NONE'}`);
      onLog(`  - Alice IK: ${session.initiatorIdentityKey?.substring(0, 16)}...`);
      onLog(`  - Alice EK: ${session.initiatorEphemeralKey?.substring(0, 16)}...`);

      const result = responderDeriveSharedSecret({
        receiverIdentityKey: currentMaterial.identityKey,
        receiverSignedPreKey: currentMaterial.signedPreKey,
        senderIdentityKey: b64ToU8(session.initiatorIdentityKey),
        senderEphemeralKey: b64ToU8(session.initiatorEphemeralKey),
        receiverOneTimePreKey: usedOTK
      });

      logCryptoStep(`X3DH (Receptor Finalizado) para <- ${session.initiator}`, {
        'Componentes DH (HKDF Input)': result.info.dhParts,
        'Chave de Criptografia (encKey)': result.encKey,
        'Chave de Autenticação (macKey)': result.macKey,
      });

      onLog(`✅ Chaves derivadas no receptor:`);
      onLog(`  - encKey: ${result.encKey.length} bytes`);
      onLog(`  - macKey: ${result.macKey.length} bytes`);
      onLog(`  - encKey (hex): ${Array.from(result.encKey).map(b => b.toString(16).padStart(2, '0')).join('')}`);
      onLog(`  - macKey (hex): ${Array.from(result.macKey).map(b => b.toString(16).padStart(2, '0')).join('')}`);

      // Generate conversation ID from session data
      const conversationId = session.conversationId;
      
      if (!conversationId) {
        onLog(`❌ Sessão ${sessionId} não tem conversationId associado`);
        return;
      }

      // Store conversation keys
      const keys: ConversationKeys = {
        encKey: result.encKey,
        macKey: result.macKey,
        derivedAt: Date.now(),
        sessionId: sessionId
      };

      storeConversationKeys(conversationId, keys);
      
      // Store conversation metadata
      storeConversationMetadata({
        id: conversationId,
        otherUser: session.initiator,
        lastActivity: Date.now()
      });

      onLog(`✅ Chaves derivadas e armazenadas para conversa ${conversationId} com ${session.initiator}`);
      onLog(`🔑 Chaves derivadas - encKey: ${keys.encKey.length} bytes, macKey: ${keys.macKey.length} bytes`);

      // Refresh conversations list
      loadConversations();

    } catch (error) {
      onLog(`❌ Erro ao processar sessão finalizada: ${error}`);
    }
  }

  // Expose session finalized handler via callback
  useEffect(() => {
    if (onSessionFinalized) {
      // This is a workaround to expose the function to parent
      (window as any).handleSessionFinalized = handleSessionFinalized;
    }
  }, [onSessionFinalized, currentMaterial]);

  function selectConversation(conv: Conversation) {
    const keys = getConversationKeys(conv.id);
    if (keys) {
      onLog(`Selecionando conversa ${conv.id} com ${conv.other_user}`);
      onLog(`Chaves encontradas - encKey: ${keys.encKey.length} bytes, macKey: ${keys.macKey.length} bytes`);
      onConversationSelect(conv.id, conv.other_user, keys);
      
      // Update last activity
      storeConversationMetadata({
        id: conv.id,
        otherUser: conv.other_user,
        lastActivity: Date.now()
      });
    } else {
      onLog(`Chaves não encontradas para conversa ${conv.id} com ${conv.other_user}`);
      onLog(`🔍 Verificando tentativas de início de conversa no servidor...`);
      
      // Check for pending session initiation when keys are missing
      checkForPendingSession(conv.id, conv.other_user);
    }
  }

  async function checkForPendingSession(conversationId: string, otherUser: string) {
    try {
      onLog(`🔍 Verificando sessões pendentes para ${otherUser}...`);
      
      // Check if the other user has initiated a session with us
      const pendingSessionRes = await fetch(API_CONFIG.ENDPOINTS.SESSIONS_PENDING(otherUser), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (pendingSessionRes.ok) {
        onLog(`✅ Sessão X3DH pendente encontrada para ${otherUser}`);
        const sessionData = await pendingSessionRes.json();
        
        // Respond to the X3DH and establish keys
        const keys = await respondToX3DH(sessionData, conversationId);
        
        // Store keys and metadata
        storeConversationKeys(conversationId, keys);
        storeConversationMetadata({
          id: conversationId,
          otherUser: otherUser,
          lastActivity: Date.now()
        });

        onLog(`🔐 Chaves estabelecidas para conversa com ${otherUser}`);
        onConversationSelect(conversationId, otherUser, keys);
        
        // Refresh conversations to show updated status
        loadConversations();
        
      } else if (pendingSessionRes.status === 404) {
        onLog(`ℹ️ Nenhuma sessão pendente encontrada para ${otherUser}`);
        onLog(`💡 O usuário ${otherUser} ainda não iniciou uma conversa com você`);
      } else {
        onLog(`⚠️ Erro ao verificar sessões pendentes: ${pendingSessionRes.status}`);
      }
      
    } catch (error) {
      onLog(`❌ Erro ao verificar sessões pendentes: ${error}`);
    }
  }

  return (
    <>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #eee'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', color: '#333' }}>Conversas</h2>
        
        {/* New conversation form */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder="Nome do usuário"
              value={newChatUser}
              onChange={(e) => setNewChatUser(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !creatingChat) {
                  createNewConversation();
                }
              }}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}
              disabled={creatingChat}
            />
            <button
              onClick={createNewConversation}
              disabled={creatingChat || !newChatUser.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                opacity: (creatingChat || !newChatUser.trim()) ? 0.6 : 1
              }}
            >
              {creatingChat ? '...' : '➕'}
            </button>
          </div>
        </div>

        <button
          onClick={loadConversations}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Carregando...' : 'Atualizar Lista'}
        </button>
      </div>

      {/* Conversations list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem'
      }}>
        {conversations.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#666',
            padding: '2rem 1rem',
            fontStyle: 'italic'
          }}>
            {loading ? 'Carregando conversas...' : 'Nenhuma conversa ainda'}
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv)}
              style={{
                padding: '0.75rem',
                margin: '0.25rem 0',
                border: '1px solid #eee',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: conv.hasKeys ? '#f8f9fa' : '#fff3cd',
                transition: 'background-color 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = conv.hasKeys ? '#e9ecef' : '#ffeaa7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = conv.hasKeys ? '#f8f9fa' : '#fff3cd';
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.5rem'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 'bold',
                    color: '#333',
                    marginBottom: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {conv.other_user}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#666'
                  }}>
                    {new Date(conv.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: conv.hasKeys ? '#28a745' : '#ffc107',
                  fontWeight: 'bold',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem'
                }}>
                  {conv.hasKeys ? '🔐' : '⚠️'}
                  {!conv.hasKeys && (
                    <span style={{ fontSize: '0.6rem', color: '#666' }}>
                      Clique para verificar
                    </span>
                  )}
                </div>
              </div>
              
              {/* Last message preview */}
              {conv.messageSummary && conv.messageSummary.lastMessage && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '0.25rem'
                }}>
                  {conv.messageSummary.lastMessage.direction === 'sent' ? 'Você: ' : `${conv.messageSummary.lastMessage.from}: `}
                  {conv.messageSummary.lastMessage.content.length > 30 
                    ? conv.messageSummary.lastMessage.content.substring(0, 30) + '...'
                    : conv.messageSummary.lastMessage.content
                  }
                </div>
              )}
              
              {/* Message count */}
              {conv.messageSummary && conv.messageSummary.totalMessages > 0 && (
                <div style={{
                  fontSize: '0.7rem',
                  color: '#999',
                  marginTop: '0.25rem'
                }}>
                  {conv.messageSummary.totalMessages} mensage{conv.messageSummary.totalMessages === 1 ? 'm' : 'ns'}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
});