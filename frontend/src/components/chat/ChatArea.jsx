import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { fetchMessages, sendMessage } from '../../services/api.js';

function createDemoMessages(group) {
  const baseName = group?.name || 'Grupo';
  const now = Date.now();
  return [
    {
      id: `${group?.id || 'demo'}-1`,
      sender: 'João',
      content: `Olá, equipe ${baseName}!`,
      timestamp: new Date(now - 60 * 60 * 1000),
      encrypted: false,
    },
    {
      id: `${group?.id || 'demo'}-2`,
      sender: 'Maria',
      content: 'Compartilhei os arquivos na pasta segura.',
      timestamp: new Date(now - 45 * 60 * 1000),
      encrypted: true,
    },
    {
      id: `${group?.id || 'demo'}-3`,
      sender: 'Pedro',
      content: 'Vamos sincronizar as chaves mais tarde?',
      timestamp: new Date(now - 15 * 60 * 1000),
      encrypted: false,
    },
  ];
}

function normaliseMembers(group) {
  if (!group || !Array.isArray(group.members)) return [];
  return group.members.map((member, index) => {
    if (typeof member === 'string' && member.trim().length > 0) {
      if (member.length <= 20 && /[a-zA-Z]/.test(member)) {
        return member;
      }
      return `Membro ${index + 1}`;
    }
    if (member && typeof member === 'object') {
      if (member.username) return member.username;
    }
    return `Membro ${index + 1}`;
  });
}

export default function ChatArea({ group }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [status, setStatus] = useState('Selecione um grupo para visualizar as mensagens.');
  const [backendMode, setBackendMode] = useState('stub');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!group) {
      setMessages([]);
      setMembers([]);
      setStatus('Selecione um grupo para começar.');
      setBackendMode('stub');
      return;
    }

    let active = true;
    const memberList = normaliseMembers(group);
    setMembers(memberList.length > 0 ? memberList : ['Alice', 'Bruno', 'Carla']);
    setLoading(true);
    setStatus('Carregando mensagens...');

    async function load() {
      try {
        const data = await fetchMessages(group.id);
        if (!active) return;
        if (!Array.isArray(data) || data.length === 0) {
          setMessages(createDemoMessages(group));
          setBackendMode('stub');
          setStatus('Nenhuma mensagem encontrada. Mostrando exemplo local.');
          return;
        }
        const normalized = data.map((item, index) => ({
          id: item.id || `${group.id}-${index}`,
          sender: item.sender || 'Participante',
          content: item.ciphertext ? 'Mensagem criptografada' : 'Mensagem recebida',
          timestamp: item.createdAt ? new Date(item.createdAt) : new Date(),
          encrypted: Boolean(item.ciphertext),
        }));
        setMessages(normalized);
        setBackendMode('api');
        setStatus('Mensagens carregadas do backend.');
      } catch (error) {
        console.info('Não foi possível carregar mensagens do backend. Utilizando dados locais.', error);
        if (!active) return;
        setMessages(createDemoMessages(group));
        setBackendMode('stub');
        setStatus('Backend indisponível. Exibindo mensagens de demonstração.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [group]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [messages],
  );

  const handleSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !group || !user) return;

    const newMessage = {
      id: crypto.randomUUID(),
      sender: user.username,
      content: trimmed,
      timestamp: new Date(),
      encrypted: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessageText('');

    if (backendMode === 'api') {
      try {
        await sendMessage(group.id, {
          senderId: user.id,
          ciphertext: trimmed,
          iv: crypto.randomUUID(),
        });
        setStatus('Mensagem enviada ao backend (sem criptografia real).');
        return;
      } catch (error) {
        console.info('Falha ao enviar mensagem ao backend, mantendo local.', error);
        setBackendMode('stub');
        setStatus('Backend indisponível. Mensagem armazenada apenas localmente.');
      }
    }
  };

  if (!group) {
    return (
      <div className="chat-area">
        <div className="chat-header">
          <div>
            <h2 style={{ margin: 0 }}>Chat seguro</h2>
            <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>Selecione um grupo ao lado para começar.</p>
          </div>
        </div>
        <div className="chat-messages" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-muted" style={{ textAlign: 'center' }}>
            <p>Escolha um grupo na lista para visualizar as conversas.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div>
          <h2 style={{ margin: 0 }}>{group.name}</h2>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>{status}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {members.map((member) => (
            <Badge key={member}>{member}</Badge>
          ))}
        </div>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div className="text-muted">Carregando...</div>
        ) : (
          sortedMessages.map((message) => {
            const isOwn = user && message.sender === user.username;
            return (
              <div key={message.id} className={`message-row ${isOwn ? 'is-own' : ''}`.trim()}>
                <div>
                  <div className="message-meta">
                    <strong>{isOwn ? 'Você' : message.sender}</strong>
                    <span>{message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {message.encrypted ? <span className="message-encrypted">🔒</span> : null}
                  </div>
                  <div className="message-bubble">{message.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-input">
        <textarea
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder={
            backendMode === 'api'
              ? 'Digite sua mensagem (será enviada como texto simples no backend)'
              : 'Digite sua mensagem (modo demonstração)'
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend}>Enviar</Button>
      </div>
    </div>
  );
}

ChatArea.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    members: PropTypes.array,
  }),
};

