import React, { useEffect, useMemo, useState } from 'react';
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
  user: 'secure-chat/user',
  bundle: 'secure-chat/private-bundle',
  groupKeys: 'secure-chat/group-keys',
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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
  const [privateBundle, setPrivateBundle] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupKeys, setGroupKeys] = useState({});
  const [pendingShares, setPendingShares] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const [usernameInput, setUsernameInput] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupMemberSelections, setGroupMemberSelections] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedUser = safeJsonParse(localStorage.getItem(STORAGE_KEYS.user), null);
    const storedBundle = safeJsonParse(localStorage.getItem(STORAGE_KEYS.bundle), null);
    const storedKeys = safeJsonParse(localStorage.getItem(STORAGE_KEYS.groupKeys), {});

    if (storedUser) setCurrentUser(storedUser);
    if (storedBundle) setPrivateBundle(deserializePrivateBundle(storedBundle));
    if (storedKeys) setGroupKeys(storedKeys);
  }, []);

  useEffect(() => {
    refreshUsers();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setGroups([]);
      setPendingShares([]);
      setSelectedGroupId(null);
      setMessages([]);
      return;
    }
    refreshGroups();
    refreshPendingShares();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedGroupId) {
      setMessages([]);
      return;
    }
    refreshMessages(selectedGroupId);
  }, [currentUser, selectedGroupId]);

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
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    setCurrentUser(user);
  }

  function persistBundle(bundle) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.bundle, JSON.stringify(bundle));
    setPrivateBundle(deserializePrivateBundle(bundle));
  }

  function persistGroupKeys(next) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.groupKeys, JSON.stringify(next));
    setGroupKeys(next);
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
      const data = await fetchJson(`${API_BASE}/groups?userId=${currentUser.id}`);
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
    if (!currentUser) return;
    try {
      const data = await fetchJson(`${API_BASE}/key-exchange/pending/${currentUser.id}`);
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

  async function handleRegisterUser(evt) {
    evt?.preventDefault();
    if (!usernameInput.trim()) {
      setStatus('Informe um nome de usuário.');
      return;
    }
    setIsBusy(true);
    try {
      const bundle = generateBundle(10);
      const serialized = serializePrivateBundle(bundle);
      const publicBundle = exportPublicBundle(bundle);
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
      persistBundle(serialized);
      setUsernameInput('');
      setStatus('Identidade registrada com sucesso.');
      refreshUsers();
    } catch (err) {
      setStatus(`Não foi possível registrar: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.user);
      localStorage.removeItem(STORAGE_KEYS.bundle);
      localStorage.removeItem(STORAGE_KEYS.groupKeys);
    }
    setCurrentUser(null);
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

  function storeGroupKey(groupId, keyBytes) {
    const keyB64 = typeof keyBytes === 'string' ? keyBytes : toB64(keyBytes);
    const bytes = typeof keyBytes === 'string' ? fromB64(keyBytes) : keyBytes;
    const next = {
      ...groupKeys,
      [groupId]: {
        key: keyB64,
        fingerprint: fingerprintKey(bytes),
        updatedAt: Date.now(),
      },
    };
    persistGroupKeys(next);
  }

  async function handleCreateGroup(evt) {
    evt?.preventDefault();
    if (!currentUser || !privateBundle) {
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
        .filter((id) => id !== currentUser.id);
      const keyBytes = random3DesKey();
      const fingerprint = fingerprintKey(keyBytes);
      const groupPayload = {
        name: groupNameInput.trim(),
        creator: currentUser.id,
        members: targetMembers,
        keyFingerprint: fingerprint,
      };
      const group = await fetchJson(`${API_BASE}/groups`, {
        method: 'POST',
        body: JSON.stringify(groupPayload),
      });
      const normalizedGroup = normalizeEntity(group);
      const groupId = extractId(normalizedGroup);
      if (!groupId) {
        throw new Error('Resposta de criação do grupo inválida (id ausente).');
      }
      storeGroupKey(groupId, keyBytes);
      setGroups((prev) => [
        { ...normalizedGroup, id: groupId },
        ...prev.filter((g) => g.id !== groupId),
      ]);
      setSelectedGroupId(groupId);
      setGroupNameInput('');
      setGroupMemberSelections([]);
      setStatus('Grupo criado. Distribuindo a chave...');

      for (const memberId of targetMembers) {
        if (!memberId) {
          console.warn('Ignorando membro sem id ao compartilhar chave');
          continue;
        }
        try {
          const bundle = await fetchJson(`${API_BASE}/key-exchange/request`, {
            method: 'POST',
            body: JSON.stringify({ receiverId: memberId, initiatorId: currentUser.id }),
          });
          const { packet, rootKeyBytes } = await performX3DHInitiatorAndCreatePacket(privateBundle, bundle);
          const wrapped = await wrapDataWithRootKey(rootKeyBytes, keyBytes, '3des-group-key');
          await fetchJson(`${API_BASE}/key-exchange/share`, {
            method: 'POST',
            body: JSON.stringify({
              groupId,
              senderId: currentUser.id,
              receiverId: memberId,
              packet,
              encryptedGroupKey: wrapped.cipher,
              keyIv: wrapped.iv,
              keyAad: wrapped.aad,
            }),
          });
        } catch (err) {
          console.error('Falha ao compartilhar chave com membro', memberId, err);
          setStatus(`Chave criada, mas não foi possível compartilhar com um dos membros (${err.message}).`);
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
    if (!currentUser || !selectedGroupId) return;
    if (!messageInput.trim()) return;
    const key = resolveGroupKey(selectedGroupId);
    if (!key) {
      setStatus('Você ainda não possui a chave desse grupo. Aceite o convite primeiro.');
      return;
    }
    try {
      const { ciphertext, iv } = encryptMessage3DES(messageInput.trim(), key);
      await fetchJson(`${API_BASE}/groups/${selectedGroupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderId: currentUser.id,
          ciphertext,
          iv,
        }),
      });
      setMessageInput('');
      refreshMessages(selectedGroupId);
    } catch (err) {
      setStatus(`Não foi possível enviar a mensagem: ${err.message}`);
    }
  }

  async function handleAcceptShare(shareId) {
    if (!currentUser || !privateBundle) return;
    const share = pendingShares.find((item) => item.id === shareId);
    if (!share) return;
    try {
      const { rootKeyBytes } = await performX3DHResponderAndDecrypt(privateBundle, share.packet);
      const plainBytes = await unwrapDataWithRootKey(rootKeyBytes, {
        cipher: share.encryptedGroupKey,
        iv: share.keyIv,
        aad: share.keyAad,
      });
      const groupId = typeof share.group === 'object' ? extractId(share.group) : share.group ?? null;
      if (!groupId) {
        throw new Error('Convite recebido sem identificador de grupo.');
      }
      storeGroupKey(groupId, plainBytes);
      await fetchJson(`${API_BASE}/key-exchange/pending/${share.id}/consume`, { method: 'POST' });
      setPendingShares((prev) => prev.filter((item) => item.id !== share.id));
      setStatus('Chave do grupo salva com sucesso.');
      refreshGroups();
    } catch (err) {
      setStatus(`Não foi possível aceitar a chave: ${err.message}`);
    }
  }

  function renderUsersList() {
    if (!currentUser) return null;
    return (
      <div className="card">
        <h3>Usuários cadastrados</h3>
        <ul className="list">
          {users.filter((u) => u.id !== currentUser.id).map((user) => (
            <li key={user.id}>{user.username}</li>
          ))}
        </ul>
      </div>
    );
  }

  function renderGroups() {
    if (!currentUser) return null;
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
    if (!currentUser) return null;
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
              .filter((u) => u.id !== currentUser.id)
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
    if (!currentUser || pendingShares.length === 0) return null;
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
                <button onClick={() => handleAcceptShare(share.id)}>Importar chave</button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function renderChat() {
    if (!currentUser || !selectedGroup) {
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
        {currentUser ? (
          <div className="user-info">
            <span>Conectado como {currentUser.username}</span>
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
      </main>
    </div>
  );
}
