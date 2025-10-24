import { useState } from 'react';
import PropTypes from 'prop-types';

export default function FriendInvitePanel({ currentUser }) {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!username.trim()) {
      setFeedback('Informe o usuário que deseja convidar.');
      return;
    }
    setFeedback(
      `Convite enviado para ${username.trim()}${currentUser ? ` por ${currentUser.username}` : ''}. ` +
        'Integre este fluxo à API para efetivar o pedido.',
    );
    setUsername('');
    setMessage('');
  };

  return (
    <div className="card friend-card">
      <h3>Adicionar contatos de confiança</h3>
      <p>
        Construa sua rede segura convidando pessoas para trocar convites de amizade. Assim que o convite for aceito,
        vocês poderão criar grupos privados rapidamente.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Usuário para convidar
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Digite o @username"
          />
        </label>
        <label>
          Mensagem pessoal (opcional)
          <textarea
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Conte o motivo do convite"
          />
        </label>
        <button type="submit">Enviar convite</button>
      </form>
      {feedback && <p className="form-feedback">{feedback}</p>}
    </div>
  );
}

FriendInvitePanel.propTypes = {
  currentUser: PropTypes.shape({
    username: PropTypes.string,
  }),
};

FriendInvitePanel.defaultProps = {
  currentUser: null,
};
