import { useMemo, useState } from 'react';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import Alert from '../ui/Alert.jsx';
import { useSecureChatContext } from '../../contexts/SecureChatContext.jsx';
import { decryptMessage3DES } from '../../crypto/triple-des.js';

export default function ChatArea() {
  const {
    state: { selectedGroup, messages, currentUserData, users },
    actions: { sendMessage, resolveGroupKey },
  } = useSecureChatContext();

  const [messageText, setMessageText] = useState('');
  const [feedback, setFeedback] = useState(null);

  const groupKey = selectedGroup ? resolveGroupKey(selectedGroup.id) : null;

  const memberNames = useMemo(() => {
    if (!selectedGroup || !Array.isArray(selectedGroup.members)) return [];
    return selectedGroup.members.map((memberId) => {
      const user = users.find((candidate) => candidate.id === memberId);
      return user?.username ?? memberId;
    });
  }, [selectedGroup, users]);

  const decryptedMessages = useMemo(() => {
    return messages.map((message) => {
      let content = 'Mensagem criptografada. Aceite a chave do grupo para ler.';
      if (groupKey) {
        try {
          content = decryptMessage3DES(message.ciphertext, groupKey, message.iv);
        } catch (error) {
          content = '[falha ao decifrar]';
        }
      }
      const timestamp = message.createdAt ? new Date(message.createdAt) : new Date();
      const senderUser = users.find((candidate) => candidate.id === message.sender);
      const senderName = senderUser?.username ?? message.sender ?? 'Participante';
      const isOwn = currentUserData && (message.sender === currentUserData.id || senderName === currentUserData.username);
      return {
        id: message.id,
        content,
        timestamp,
        senderName: isOwn ? 'Você' : senderName,
        isOwn,
        encrypted: Boolean(message.ciphertext),
      };
    });
  }, [messages, groupKey, users, currentUserData]);

  const handleSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !selectedGroup) return;
    const result = await sendMessage(trimmed);
    if (!result.success) {
      setFeedback({ type: 'error', message: result.message ?? 'Não foi possível enviar a mensagem.' });
      return;
    }
    setFeedback({ type: 'success', message: 'Mensagem enviada e armazenada no backend.' });
    setMessageText('');
    setTimeout(() => setFeedback(null), 2500);
  };

  if (!selectedGroup) {
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
            <p>Escolha um grupo na lista para visualizar as conversas protegidas.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div>
          <h2 style={{ margin: 0 }}>{selectedGroup.name}</h2>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
            {groupKey
              ? 'As mensagens são cifradas com 3DES antes de sair do navegador.'
              : 'Aceite o convite correspondente para liberar a chave do grupo.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {memberNames.map((member) => (
            <Badge key={member}>{member}</Badge>
          ))}
        </div>
      </div>

      <div className="chat-messages">
        {decryptedMessages.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', width: '100%' }}>
            Nenhuma mensagem registrada para este grupo.
          </div>
        ) : (
          decryptedMessages.map((message) => (
            <div key={message.id} className={`message-row ${message.isOwn ? 'is-own' : ''}`.trim()}>
              <div>
                <div className="message-meta">
                  <strong>{message.senderName}</strong>
                  <span>{message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  {message.encrypted ? <span className="message-encrypted">🔒</span> : null}
                </div>
                <div className="message-bubble">{message.content}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-input">
        {feedback ? <Alert variant={feedback.type}>{feedback.message}</Alert> : null}
        <textarea
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder={
            groupKey
              ? 'Digite sua mensagem. Ela será cifrada automaticamente antes do envio.'
              : 'Aguarde a chave do grupo para habilitar o envio.'
          }
          disabled={!groupKey}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={!groupKey}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
