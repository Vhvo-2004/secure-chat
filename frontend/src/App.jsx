import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  deserializePrivateBundle,
  exportPublicBundle,
  fingerprintKey,
  generateBundle,
  performX3DHInitiatorAndCreatePacket,
  performX3DHResponderAndDecrypt,
  serializePrivateBundle,
  wrapDataWithRootKey,
  unwrapDataWithRootKey,
} from './crypto/x3dh';
import { toB64, fromB64 } from './crypto/utils';
import { decryptMessage3DES, encryptMessage3DES, random3DesKey } from './crypto/triple-des';
import './App.css';

const STORAGE_KEYS = {
  user: 'secure-chat/user/',
  bundle: 'secure-chat/private-bundle/',
  groupKeys: 'secure-chat/group-keys/',
  currentUser: 'secure-chat/currentUser',
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5173/api';

function extractId(entity) {
  if (!entity) return null;
  if (typeof entity === 'string') return entity;
  return entity.id ?? entity._id ?? null;
}

function normalizeEntity(entity) {
  if (!entity || typeof entity === 'string') return entity;
  const id = extractId(entity);
  return id ? { ...entity, id } : entity;
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    return fallback;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [privateBundle, setPrivateBundle] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupKeys, setGroupKeys] = useState({});
  const [pendingShares, setPendingShares] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [cryptoLog, setCryptoLog] = useState([]);

  const [usernameInput, setUsernameInput] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupMemberSelections, setGroupMemberSelections] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const appendCryptoLog = useCallback((entry) => {
    setCryptoLog((prev) => {
      const next = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
          ...entry,
        },
        ...prev,
      ];
      return next.slice(0, 200);
    });
  }, []);

  const consumeOneTimePreKey = useCallback((username, rawIndex) => {
    const normalized =
      rawIndex === null || rawIndex === undefined
        ? null
        : typeof rawIndex === 'string'
        ? parseInt(rawIndex, 10)
        : rawIndex;
    if (normalized === null || Number.isNaN(normalized)) {
      return;
    }
    setPrivateBundle((prev) => {
      if (!prev) return prev;
      const nextPreKeys = prev.oneTimePreKeys.filter((kp, idx) => {
        const kpIndex = kp.index ?? idx;
        return kpIndex !== normalized;
      });
      if (nextPreKeys.length === prev.oneTimePreKeys.length) {
        return prev;
      }
      const nextBundle = { ...prev, oneTimePreKeys: nextPreKeys };
      const serialized = serializePrivateBundle(nextBundle);
      if (typeof window !== 'undefined') {
        console.log(1, username);
        localStorage.setItem(`${STORAGE_KEYS.bundle}${username}`, JSON.stringify(serialized));
      }
      return deserializePrivateBundle(serialized);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentUser = safeJsonParse(sessionStorage.getItem(STORAGE_KEYS.currentUser), null);
    console.log(STORAGE_KEYS.currentUser, currentUser);
    setCurrentUser(currentUser);
    const storedBundle = safeJsonParse(localStorage.getItem(`${STORAGE_KEYS.bundle}${currentUser}`), null);
    const storedKeys = safeJsonParse(localStorage.getItem(`${STORAGE_KEYS.groupKeys}${currentUser}`), {});
    const storedUser = safeJsonParse(localStorage.getItem(`${STORAGE_KEYS.user}${currentUser}`), null);

    if (currentUser && storedUser) setCurrentUserData(storedUser);
    if (storedBundle) setPrivateBundle(deserializePrivateBundle(storedBundle));
    if (storedKeys) setGroupKeys(storedKeys);
  }, []);

  useEffect(() => {
    refreshUsers();
  }, []);

  useEffect(() => {
    if (!currentUserData) {
      setGroups([]);
      setPendingShares([]);
      setSelectedGroupId(null);
      setMessages([]);
      return;
    }
    refreshGroups();
    refreshPendingShares();
  }, [currentUserData]);

  useEffect(() => {
    if (!currentUserData || !selectedGroupId) {
      setMessages([]);
      return;
    }
    refreshMessages(selectedGroupId);
  }, [currentUserData, selectedGroupId]);

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function persistUser(user) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user.username));
    localStorage.setItem(`${STORAGE_KEYS.user}${user.username}`, JSON.stringify(user));
    setCurrentUser(user.username);
    setCurrentUserData(user);
    console.log('user persisted');
  }

  function searchUser(username){
    if (typeof username !== 'string' || username.trim() === '')
      return null;

    const searchedUser = safeJsonParse(sessionStorage.getItem(`${STORAGE_KEYS.user}${username}`), null);
    return searchedUser;
  }

  function persistBundle(bundle, username) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${STORAGE_KEYS.bundle}${username}`, JSON.stringify(bundle));
    setPrivateBundle(deserializePrivateBundle(bundle));
  }

  function persistGroupKeys(next, username) {
    if (typeof window === 'undefined') return;
    console.log(2, username);
    localStorage.setItem(`${STORAGE_KEYS.groupKeys}${username}`, JSON.stringify(next));
    setGroupKeys(next);
  }

  function storeGroupKey(username, groupId, keyInput, options = {}) {
    if (!groupId || !keyInput) return;
    const bytes = typeof keyInput === 'string' ? fromB64(keyInput) : keyInput;
    const keyB64 = typeof keyInput === 'string' ? keyInput : toB64(bytes);
    const fingerprint = fingerprintKey(bytes);
    const next = {
      ...groupKeys,
      [groupId]: {
        key: keyB64,
        fingerprint,
        updatedAt: Date.now(),
      },
    };
    console.log(username);
    persistGroupKeys(next, username);

    if (options.log === false) {
      return;
    }

    appendCryptoLog({
      phase: options.phase ?? 'Chaves de grupo',
      title: options.title ?? 'Chave 3DES armazenada',
      description:
        options.description ??
        'A chave simétrica do grupo foi salva no storage local para uso futuro.',
      reason:
        options.reason ??
        'Sem essa chave 3DES não conseguimos cifrar nem decifrar as mensagens do grupo.',
      artifacts: [
        { label: 'Grupo', value: options.groupName ?? groupId },
        { label: 'Fingerprint registrada', value: fingerprint },
        ...(options.showKey === false
          ? []
          : [{ label: 'Chave 3DES (base64)', value: keyB64 }]),
        ...(options.artifacts ?? []),
      ],
    });
  }

  async function refreshUsers() {
    try {
      const data = await fetchJson(`${API_BASE}/users`);
      const normalized = data
        .map((user) => {
          const id = extractId(user);
          if (!id) return null;
          return { ...user, id };
        })
        .filter(Boolean);
      setUsers(normalized);
    } catch (err) {
      setStatus(`Falha ao carregar usuários: ${err.message}`);
    }
  }

  async function refreshGroups() {
    try {
      const data = await fetchJson(`${API_BASE}/groups?userId=${currentUserData.id}`);
      const normalized = data
        .map((group) => {
          const id = extractId(group);
          if (!id) return null;
          const members = Array.isArray(group.members)
            ? group.members
                .map((member) => (typeof member === 'string' ? member : extractId(member)))
                .filter(Boolean)
            : [];
          return {
            ...group,
            id,
            members,
          };
        })
        .filter(Boolean);
      setGroups(normalized);
    } catch (err) {
      setStatus(`Falha ao carregar grupos: ${err.message}`);
    }
  }

  async function refreshMessages(groupId) {
    try {
      const data = await fetchJson(`${API_BASE}/groups/${groupId}/messages`);
      const normalized = data.map((message) => {
        const id = extractId(message);
        return {
          ...message,
          id: id ?? `${message.sender}-${message.createdAt ?? ''}-${message.ciphertext ?? ''}`,
          sender: typeof message.sender === 'string' ? message.sender : extractId(message.sender),
          group: typeof message.group === 'string' ? message.group : extractId(message.group),
        };
      });
      setMessages(normalized);
    } catch (err) {
      setStatus(`Falha ao carregar mensagens: ${err.message}`);
    }
  }

  async function refreshPendingShares() {
    if (!currentUserData) return;
    try {
      const data = await fetchJson(`${API_BASE}/key-exchange/pending/${currentUserData.id}`);
      const normalized = data
        .map((share) => {
          const id = extractId(share);
          if (!id) return null;
          const sender =
            share.sender && typeof share.sender === 'object'
              ? normalizeEntity(share.sender)
              : share.sender;
          const group =
            share.group && typeof share.group === 'object'
              ? {
                  ...normalizeEntity(share.group),
                  members: Array.isArray(share.group.members)
                    ? share.group.members
                        .map((member) => (typeof member === 'string' ? member : extractId(member)))
                        .filter(Boolean)
                    : [],
                }
              : share.group;
          return {
            ...share,
            id,
            sender,
            group,
          };
        })
        .filter(Boolean);
      setPendingShares(normalized);
    } catch (err) {
      setStatus(`Falha ao carregar convites: ${err.message}`);
    }
  }

  function handleLogin(username){
    const searchResult = searchUser(username);
    if (!searchResult)
        return false;
    sessionStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(username))
    setCurrentUser(username);
    // persistUser(normalizedUser);
    // persistBundle(serialized, normalizedUser.username);
    // setUsernameInput('');
    // setStatus('Identidade registrada com sucesso.');
    // refreshUsers();
  }

  async function handleRegisterUser(evt) {
    evt?.preventDefault();
    if (!usernameInput.trim()) {
      setStatus('Informe um nome de usuário.');
      return;
    }
    const exists = handleLogin(usernameInput.trim());
    if (exists) return;
    setIsBusy(true);
    try {
      const bundle = generateBundle(10);
      const serialized = serializePrivateBundle(bundle);
      const publicBundle = exportPublicBundle(bundle);
      appendCryptoLog({
        phase: 'Identidade',
        title: 'Bundle X3DH gerado localmente',
        description: 'Criamos pares de chaves de identidade, assinatura, signed pre-key e 10 one-time pre-keys.',
        reason: 'O protocolo X3DH depende desse conjunto para autenticar usuários e oferecer sigilo direto.',
        artifacts: [
          { label: 'IK (box) pública', value: toB64(bundle.identityKeyBox.publicKey) },
          { label: 'IK (assinatura) pública', value: toB64(bundle.identityKeySign.publicKey) },
          { label: 'Signed pre-key', value: toB64(bundle.signedPreKey.publicKey) },
          { label: 'Assinatura da signed pre-key', value: toB64(bundle.signature) },
          { label: 'One-time pre-keys', value: bundle.oneTimePreKeys.length },
        ],
      });
      const payload = {
        username: usernameInput.trim(),
        identityKeyBox: publicBundle.identityKeyBox,
        identityKeySign: publicBundle.identityKeySign,
        signedPreKey: publicBundle.signedPreKey,
        signedPreKeySignature: publicBundle.signature,
        oneTimePreKeys: publicBundle.oneTimePreKeys,
      };
      const user = await fetchJson(`${API_BASE}/users`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const normalizedUser = { ...user, id: extractId(user) ?? user.id };
      persistUser(normalizedUser);
      persistBundle(serialized, normalizedUser.username);
      appendCryptoLog({
        phase: 'Identidade',
        title: 'Bundle público publicado',
        description: `O servidor armazenou o material público de ${payload.username}.`,
        reason: 'Outros clientes precisam dessas pre-keys para iniciar convites X3DH com autenticação.',
        artifacts: [
          { label: 'Usuário', value: normalizedUser.username },
          { label: 'One-time pre-keys disponíveis', value: payload.oneTimePreKeys.length },
        ],
      });
      appendCryptoLog({
        phase: 'Identidade',
        title: 'Bundle privado guardado no navegador',
        description: 'Persistimos as chaves secretas serializadas no armazenamento local.',
        reason: 'Precisamos recuperar esse material para responder a convites e decifrar envelopes.',
        artifacts: [
          { label: 'Campos preservados', value: Object.keys(serialized).join(', ') },
        ],
      });
      setUsernameInput('');
      setStatus('Identidade registrada com sucesso.');
      refreshUsers();
    } catch (err) {
      setStatus(`Não foi possível registrar: ${err.message}`);
      appendCryptoLog({
        phase: 'Identidade',
        title: 'Falha ao registrar identidade',
        description: `Erro durante o cadastro: ${err.message}`,
        reason: 'Registrar a falha ajuda a identificar se o problema ocorreu antes do upload das chaves.',
      });
    } finally {
      setIsBusy(false);
    }
  }

  function handleLogout() {
    // if (typeof window !== 'undefined') {
    //   localStorage.removeItem(STORAGE_KEYS.user);
    //   localStorage.removeItem(STORAGE_KEYS.bundle);
    //   localStorage.removeItem(STORAGE_KEYS.groupKeys);
    // }
    sessionStorage.clear()
    setCurrentUserData(null);
    setPrivateBundle(null);
    setGroupKeys({});
    setGroups([]);
    setMessages([]);
    setPendingShares([]);
    setSelectedGroupId(null);
    setStatus('Sessão limpa.');
  }

  function toggleMemberSelection(rawUserId) {
    const userId = rawUserId ?? null;
    if (!userId) return;
    setGroupMemberSelections((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  }

  async function handleCreateGroup(evt) {
    evt?.preventDefault();
    if (!currentUserData || !privateBundle) {
      setStatus('Gere e registre sua identidade antes de criar grupos.');
      return;
    }
    if (!groupNameInput.trim()) {
      setStatus('Informe um nome para o grupo.');
      return;
    }
    setIsBusy(true);
    try {
      const targetMembers = groupMemberSelections
        .filter(Boolean)
        .filter((id) => id !== currentUserData.id);
      const keyBytes = random3DesKey();
      const fingerprint = fingerprintKey(keyBytes);
      const groupPayload = {
        name: groupNameInput.trim(),
        creator: currentUserData.id,
        members: targetMembers,
        keyFingerprint: fingerprint,
      };
      appendCryptoLog({
        phase: 'Grupos',
        title: 'Solicitação de criação de grupo',
        description: `Preparando o grupo "${groupPayload.name}" com fingerprint ${fingerprint}.`,
        reason:
          'Precisamos registrar o grupo no backend para orquestrar convites e mensagens cifradas.',
        artifacts: [
          { label: 'Criador', value: currentUserData.username },
          {
            label: 'Participantes convidados',
            value:
              targetMembers.length > 0
                ? targetMembers
                    .map((id) => users.find((u) => u.id === id)?.username ?? id)
                    .join(', ')
                : 'Somente o criador',
          },
        ],
      });

      const group = await fetchJson(`${API_BASE}/groups`, {
        method: 'POST',
        body: JSON.stringify(groupPayload),
      });
      const normalizedGroup = normalizeEntity(group);
      const groupId = extractId(normalizedGroup);
      if (!groupId) {
        throw new Error('Resposta de criação do grupo inválida (id ausente).');
      }
      storeGroupKey(currentUser, groupId, keyBytes, {
        phase: 'Chaves de grupo',
        title: 'Chave 3DES gerada para o novo grupo',
        description: `Geramos uma chave simétrica única para o grupo "${groupPayload.name}".`,
        reason: 'Cada grupo precisa de uma chave exclusiva para manter o isolamento das conversas.',
        groupName: groupPayload.name,
        artifacts: [
          { label: 'Fingerprint esperado', value: fingerprint },
          { label: 'Membros iniciais', value: [currentUserData.id, ...targetMembers].length },
        ],
      });
      setGroups((prev) => [
        { ...normalizedGroup, id: groupId },
        ...prev.filter((g) => g.id !== groupId),
      ]);
      setSelectedGroupId(groupId);
      setGroupNameInput('');
      setGroupMemberSelections([]);
      setStatus('Grupo criado. Distribuindo a chave...');

      appendCryptoLog({
        phase: 'Grupos',
        title: 'Grupo registrado no backend',
        description: `O backend confirmou o grupo "${normalizedGroup.name ?? groupPayload.name}".`,
        reason: 'Somente após o registro podemos distribuir chaves e trocar mensagens.',
        artifacts: [
          { label: 'ID do grupo', value: groupId },
          {
            label: 'Fingerprint registrada',
            value: normalizedGroup.keyFingerprint ?? fingerprint,
          },
        ],
      });

      for (const memberId of targetMembers) {
        if (!memberId) {
          console.warn('Ignorando membro sem id ao compartilhar chave');
          continue;
        }
        try {
          const bundle = await fetchJson(`${API_BASE}/key-exchange/request`, {
            method: 'POST',
            body: JSON.stringify({ receiverId: memberId, initiatorId: currentUserData.id }),
          });
          const { packet, rootKeyBytes } = await performX3DHInitiatorAndCreatePacket(privateBundle, bundle);
          const wrapped = await wrapDataWithRootKey(rootKeyBytes, keyBytes, '3des-group-key');
          await fetchJson(`${API_BASE}/key-exchange/share`, {
            method: 'POST',
            body: JSON.stringify({
              groupId,
              senderId: currentUserData.id,
              receiverId: memberId,
              packet,
              encryptedGroupKey: wrapped.cipher,
              keyIv: wrapped.iv,
              keyAad: wrapped.aad,
            }),
          });

          const receiverUser = users.find((u) => u.id === memberId);
          appendCryptoLog({
            phase: 'Distribuição X3DH',
            title: `Envelope enviado para ${receiverUser?.username ?? memberId}`,
            description:
              'Derivamos a root key combinando IK, SPK, EK e OPK e ciframos a chave 3DES com AES-GCM.',
            reason:
              'Esse passo garante que somente o convidado consiga recuperar a chave do grupo com autenticidade.',
            artifacts: [
              { label: 'Grupo', value: normalizedGroup.name ?? groupPayload.name },
              { label: 'Destinatário', value: receiverUser?.username ?? memberId },
              { label: 'Root key (base64)', value: toB64(rootKeyBytes) },
              {
                label: 'OPK utilizada',
                value: packet.opk_index !== null && packet.opk_index !== undefined ? packet.opk_index : 'Nenhuma',
              },
              { label: 'EK_A pública', value: packet.EK_A_pub },
              { label: 'AAD do envelope', value: packet.aad },
              { label: 'Cipher AES-GCM', value: wrapped.cipher },
            ],
          });
        } catch (err) {
          console.error('Falha ao compartilhar chave com membro', memberId, err);
          setStatus(`Chave criada, mas não foi possível compartilhar com um dos membros (${err.message}).`);
          appendCryptoLog({
            phase: 'Distribuição X3DH',
            title: `Falha ao compartilhar com ${memberId}`,
            description: `Não conseguimos enviar o envelope seguro: ${err.message}`,
            reason:
              'Sem distribuir o envelope X3DH o destinatário não terá a chave 3DES e ficará excluído do grupo.',
          });
        }
      }
      refreshPendingShares();
      refreshGroups();
      setStatus('Grupo criado e chaves distribuídas.');
    } catch (err) {
      setStatus(`Não foi possível criar o grupo: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  }

  function resolveGroupKey(groupId) {
    return groupKeys[groupId]?.key ?? null;
  }

  async function handleSendMessage(evt) {
    evt?.preventDefault();
    if (!currentUserData || !selectedGroupId) return;
    if (!messageInput.trim()) return;
    const key = resolveGroupKey(selectedGroupId);
    if (!key) {
      setStatus('Você ainda não possui a chave desse grupo. Aceite o convite primeiro.');
      return;
    }
    try {
      const { ciphertext, iv } = encryptMessage3DES(messageInput.trim(), key);
      appendCryptoLog({
        phase: 'Mensagens',
        title: 'Mensagem cifrada com 3DES',
        description: `Conteúdo cifrado antes do envio para o grupo "${selectedGroup.name}".`,
        reason: 'O servidor só deve receber mensagens já cifradas para manter o sigilo fim a fim.',
        artifacts: [
          { label: 'Ciphertext', value: ciphertext },
          { label: 'IV', value: iv },
          { label: 'Mensagem original', value: messageInput.trim() },
        ],
      });
      await fetchJson(`${API_BASE}/groups/${selectedGroupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderId: currentUserData.id,
          ciphertext,
          iv,
        }),
      });
      setMessageInput('');
      refreshMessages(selectedGroupId);
    } catch (err) {
      setStatus(`Não foi possível enviar a mensagem: ${err.message}`);
      appendCryptoLog({
        phase: 'Mensagens',
        title: 'Falha ao cifrar/enviar mensagem',
        description: `Erro ao enviar para ${selectedGroup.name}: ${err.message}`,
        reason: 'Registrar a falha ajuda a entender se o problema ocorreu antes ou depois da criptografia.',
      });
    }
  }

  function handleShare(shareId){
    const user = currentUser;
    console.log(4, user);
    handleAcceptShare(shareId, user);
  }

  async function handleAcceptShare(shareId, username) {
    if (!currentUserData || !privateBundle) return;
    const share = pendingShares.find((item) => item.id === shareId);
    if (!share) return;
    try {
      const { rootKeyBytes, payload, usedOpkIndex, resolvedWithFallback } =
        await performX3DHResponderAndDecrypt(
          privateBundle,
          share.packet,
        );
      if (usedOpkIndex !== null && usedOpkIndex !== undefined) {
        consumeOneTimePreKey(username, usedOpkIndex);
      }
      const plainBytes = await unwrapDataWithRootKey(rootKeyBytes, {
        cipher: share.encryptedGroupKey,
        iv: share.keyIv,
        aad: share.keyAad,
      });
      const groupId = typeof share.group === 'object' ? extractId(share.group) : share.group ?? null;
      if (!groupId) {
        throw new Error('Convite recebido sem identificador de grupo.');
      }
      const senderName = share.sender?.username ?? share.sender ?? 'Remetente';
      appendCryptoLog({
        phase: 'Recepção X3DH',
        title: `Envelope aceito de ${senderName}`,
        description:
          'Recalculamos o segredo compartilhado usando IK, SPK, EK e OPK e obtivemos a root key para abrir o envelope.',
        reason: 'Precisamos validar a autenticidade do remetente antes de importar a chave do grupo.',
        artifacts: [
          { label: 'Root key (base64)', value: toB64(rootKeyBytes) },
          {
            label: 'OPK consumida',
            value:
              usedOpkIndex !== null && usedOpkIndex !== undefined
                ? `${usedOpkIndex}${resolvedWithFallback ? ' (fallback aplicado)' : ''}`
                : 'Nenhuma',
          },
          {
            label: 'OPK indicada pelo remetente',
            value:
              share.packet?.opk_index !== null && share.packet?.opk_index !== undefined
                ? share.packet?.opk_index
                : 'Nenhuma',
          },
          { label: 'IK do remetente (payload)', value: payload?.IK_A_fromPayload ?? 'Indisponível' },
          { label: 'AAD recebido', value: share.keyAad },
        ],
      });

      const groupName = typeof share.group === 'object' ? share.group.name : null;
      console.log(3, username);
      storeGroupKey(username, groupId, plainBytes, {
        phase: 'Chaves de grupo',
        title: 'Chave 3DES importada',
        description: `Chave do grupo "${groupName ?? groupId}" decifrada e armazenada localmente.`,
        reason: 'Sem persistir a chave não conseguimos decifrar mensagens passadas nem enviar novas mensagens.',
        groupName: groupName ?? groupId,
        artifacts: [
          { label: 'Fingerprint esperada', value: share.group?.keyFingerprint ?? '—' },
        ],
      });
      await fetchJson(`${API_BASE}/key-exchange/pending/${share.id}/consume`, { method: 'POST' });
      setPendingShares((prev) => prev.filter((item) => item.id !== share.id));
      setStatus(
        resolvedWithFallback
          ? 'Chave do grupo salva com sucesso. (OPK reconciliada via fallback local.)'
          : 'Chave do grupo salva com sucesso.',
      );
      refreshGroups();
    } catch (err) {
      const message = err?.message ?? 'Erro desconhecido';
      setStatus(`Não foi possível aceitar a chave: ${message}`);
      appendCryptoLog({
        phase: 'Recepção X3DH',
        title: 'Falha ao aceitar envelope',
        description: `Erro ao importar a chave: ${message}`,
        reason: 'Registrar a falha ajuda a identificar em qual etapa do X3DH a importação quebrou.',
        artifacts: [
          { label: 'Share', value: shareId },
          { label: 'Grupo', value: share.group?.name ?? share.group ?? '—' },
        ],
      });
    }
  }

  function renderCryptoLogs() {
    return (
      <section className="column full">
        <div className="card log-card">
          <h3>Diário criptográfico</h3>
          {cryptoLog.length === 0 ? (
            <p>
              Os detalhes de X3DH e 3DES aparecerão aqui assim que você gerar identidades,
              compartilhar convites ou enviar mensagens.
            </p>
          ) : (
            <ul className="log-list">
              {cryptoLog.map((entry) => (
                <li key={entry.id} className="log-entry">
                  <div className="log-header">
                    <div className="log-header-main">
                      <span className="log-phase">{entry.phase}</span>
                      <span className="log-title">{entry.title}</span>
                    </div>
                    <time>{new Date(entry.timestamp).toLocaleString()}</time>
                  </div>
                  {entry.description && <p className="log-description">{entry.description}</p>}
                  {entry.reason && (
                    <p className="log-reason">
                      <strong>Por que:</strong> {entry.reason}
                    </p>
                  )}
                  {entry.artifacts && entry.artifacts.length > 0 && (
                    <dl className="log-artifacts">
                      {entry.artifacts.map((artifact, index) => (
                        <div key={`${entry.id}-artifact-${index}`} className="log-artifact">
                          <dt>{artifact.label}</dt>
                          <dd>{artifact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  function renderUsersList() {
    if (!currentUserData) return null;
    return (
      <div className="card">
        <h3>Usuários cadastrados</h3>
        <ul className="list">
          {users.filter((u) => u.id !== currentUserData.id).map((user) => (
            <li key={user.id}>{user.username}</li>
          ))}
        </ul>
      </div>
    );
  }

  function renderGroups() {
    if (!currentUserData) return null;
    return (
      <div className="card">
        <h3>Grupos</h3>
        <ul className="list groups">
          {groups.map((group) => {
            const keyInfo = groupKeys[group.id];
            const missingKey = !keyInfo;
            return (
              <li
                key={group.id}
                className={group.id === selectedGroupId ? 'active' : ''}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <div className="group-title">{group.name}</div>
                <div className="group-meta">
                  <span>Membros: {group.members?.length ?? 0}</span>
                  <span>
                    Chave: {missingKey ? 'aguardando' : keyInfo.fingerprint}
                    {group.keyFingerprint && !missingKey && keyInfo.fingerprint !== group.keyFingerprint
                      ? ' ⚠' : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function renderCreateGroup() {
    if (!currentUserData) return null;
    return (
      <div className="card">
        <h3>Novo grupo</h3>
        <form onSubmit={handleCreateGroup} className="form">
          <label>
            Nome do grupo
            <input
              type="text"
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              placeholder="Ex.: Squad Segurança"
            />
          </label>
          <span className="hint">Selecione os participantes (você é incluído automaticamente).</span>
          <div className="members-grid">
            {users
              .filter((u) => u.id !== currentUserData.id)
              .map((user) => (
                <label key={user.id} className="member-option">
                  <input
                    type="checkbox"
                    checked={groupMemberSelections.includes(user.id)}
                    onChange={() => toggleMemberSelection(user.id)}
                  />
                  {user.username}
                </label>
              ))}
          </div>
          <button type="submit" disabled={isBusy}>
            Criar grupo e compartilhar chave 3DES
          </button>
        </form>
      </div>
    );
  }

  function renderPendingShares() {
    if (!currentUserData || pendingShares.length === 0) return null;
    return (
      <div className="card">
        <h3>Convites pendentes</h3>
        <ul className="list">
          {pendingShares.map((share) => {
            const groupInfo = typeof share.group === 'object' ? share.group : null;
            return (
              <li key={share.id} className="share-item">
                <div>
                  <strong>{groupInfo?.name ?? 'Grupo'}</strong>
                  <div className="share-meta">
                    Enviado por {share.sender?.username ?? share.sender}
                    {groupInfo?.keyFingerprint && (
                      <span> · Fingerprint: {groupInfo.keyFingerprint}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleShare(share.id)}>Importar chave</button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function renderChat() {
    if (!currentUserData || !selectedGroup) {
      return (
        <div className="card">
          <h3>Mensagens</h3>
          <p>Selecione um grupo para visualizar as mensagens.</p>
        </div>
      );
    }
    const key = resolveGroupKey(selectedGroup.id);
    return (
      <div className="card chat">
        <h3>Chat · {selectedGroup.name}</h3>
        <div className="messages">
          {messages.map((message) => {
            let decrypted = '***';
            if (key) {
              try {
                decrypted = decryptMessage3DES(message.ciphertext, key, message.iv);
              } catch (err) {
                decrypted = '[falha ao decifrar]';
              }
            }
            const senderName =
              users.find((u) => u.id === message.sender)?.username || message.sender;
            return (
              <div key={message.id} className="message">
                <div className="message-header">
                  <span>{senderName}</span>
                  <time>{new Date(message.createdAt ?? Date.now()).toLocaleString()}</time>
                </div>
                <div className="message-body">{decrypted}</div>
              </div>
            );
          })}
        </div>
        <form onSubmit={handleSendMessage} className="form send-form">
          <input
            type="text"
            placeholder={key ? 'Digite sua mensagem cifrada...' : 'Aguardando chave do grupo'}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            disabled={!key}
          />
          <button type="submit" disabled={!key}>
            Enviar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <h1>Secure Chat · Sessões X3DH + 3DES</h1>
        {currentUserData ? (
          <div className="user-info">
            <span>Conectado como {currentUserData.username}</span>
            <button onClick={handleLogout}>Encerrar sessão local</button>
          </div>
        ) : (
          <form onSubmit={handleRegisterUser} className="form inline">
            <input
              type="text"
              value={usernameInput}
              placeholder="Escolha um nome de usuário"
              onChange={(e) => setUsernameInput(e.target.value)}
            />
            <button type="submit" disabled={isBusy}>
              Gerar identidade & registrar
            </button>
          </form>
        )}
      </header>

      {status && <div className="status">{status}</div>}

      <main>
        <section className="column">
          {renderUsersList()}
          {renderPendingShares()}
        </section>
        <section className="column">
          {renderCreateGroup()}
          {renderGroups()}
        </section>
        <section className="column wide">{renderChat()}</section>
        {renderCryptoLogs()}
      </main>
    </div>
  );
}
