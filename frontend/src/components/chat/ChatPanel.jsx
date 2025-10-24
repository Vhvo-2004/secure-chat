import PropTypes from 'prop-types';
import { decryptMessage3DES } from '../../crypto/triple-des';

export default function ChatPanel({
  currentUser,
  selectedGroup,
  messages,
  users,
  messageInput,
  onMessageChange,
  onSendMessage,
  groupKey,
}) {
  if (!currentUser) {
    return (
      <div className="card">
        <h3>Mensagens</h3>
        <p>Cadastre-se para visualizar e enviar mensagens.</p>
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <div className="card">
        <h3>Mensagens</h3>
        <p>Selecione um grupo para visualizar as mensagens.</p>
      </div>
    );
  }

  return (
    <div className="card chat">
      <h3>Chat · {selectedGroup.name}</h3>
      <div className="messages">
        {messages.map((message) => {
          let decrypted = '***';
          if (groupKey) {
            try {
              decrypted = decryptMessage3DES(message.ciphertext, groupKey, message.iv);
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
      <form onSubmit={onSendMessage} className="form send-form">
        <input
          type="text"
          placeholder={groupKey ? 'Digite sua mensagem cifrada...' : 'Aguardando chave do grupo'}
          value={messageInput}
          onChange={(e) => onMessageChange(e.target.value)}
          disabled={!groupKey}
        />
        <button type="submit" disabled={!groupKey}>
          Enviar
        </button>
      </form>
    </div>
  );
}

ChatPanel.propTypes = {
  currentUser: PropTypes.object,
  selectedGroup: PropTypes.object,
  messages: PropTypes.array.isRequired,
  users: PropTypes.array.isRequired,
  messageInput: PropTypes.string.isRequired,
  onMessageChange: PropTypes.func.isRequired,
  onSendMessage: PropTypes.func.isRequired,
  groupKey: PropTypes.string,
};
