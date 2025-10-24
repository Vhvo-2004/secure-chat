import { useParams } from 'react-router-dom';

export default function GroupChatPage() {
  const { groupId } = useParams();

  return (
    <div className="page-container">
      <h2>Chat do grupo: {groupId}</h2>
      <p>Área de protótipo para enviar mensagens ao grupo.</p>
      <div className="card chat">
        <div className="messages">
          <div className="message">
            <div className="message-header">
              <span>alice</span>
              <time>{new Date().toLocaleString()}</time>
            </div>
            <div className="message-body">Bem-vindo ao canal de testes!</div>
          </div>
        </div>
        <form className="form send-form" onSubmit={(event) => event.preventDefault()}>
          <input type="text" placeholder="Mensagem de exemplo" />
          <button type="submit">Enviar</button>
        </form>
      </div>
    </div>
  );
}
