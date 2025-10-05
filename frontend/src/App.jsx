import React, { useState } from 'react';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const mockConversations = [
    { id: 1, name: 'Carlos', preview: 'Mano, preciso de uma parada...', time: '12:37' },
    { id: 2, name: 'ReaisSA', preview: 'Luigi:Como ja dito, so tem aula para quem...', time: '00:49' },
    { id: 3, name: 'RenanMewing', preview: 'O que sobra para o beta?', time: '00:40' },
    { id: 4, name: 'Andrey', preview: 'O meu pai comeu tua castanha...', time: 'Ontem' },
    { id: 5, name: 'Yobamos', preview: 'Pegaram o william de novo', time: 'Ontem' },
    { id: 6, name: 'Meu numero: (You)', preview: 'Lembre-se:', time: 'Ontem' },
  ];

  const handleLogin = () => {
    if (username.trim() === '' || password.trim() === '') {
      alert('Preencha todos os campos.');
      return;
    }
    setLoggedIn(true);
  };

  if (!loggedIn) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <h2 style={styles.loginTitle}>🔐 Login</h2>
          <input
            type="text"
            placeholder="Usuário"
            style={styles.input}
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha"
            style={styles.input}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button style={styles.loginButton} onClick={handleLogin}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <div style={styles.sidebar}>
        <div style={styles.searchBar}>
          <input type="text" placeholder="🔍 Procurar conversa..." style={styles.searchInput} />
        </div>
        <div style={styles.chatList}>
          {mockConversations.map(chat => (
            <div key={chat.id} style={styles.chatItem}>
              <div>
                <strong>{chat.name}</strong>
                <p style={styles.preview}>{chat.preview}</p>
              </div>
              <span style={styles.time}>{chat.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.chatWindow}>
        <div style={styles.chatHeader}>
          <strong>Meu numero: (You)</strong>
        </div>
        <div style={styles.chatMessages}>
          <div style={styles.messageBubbleGreen}>
            <pre style={styles.messageText}>Eae meu, tudo joia</pre>
          </div>
          <div style={styles.messageBubbleLink}>
            https://discord.gg/NFSc23Db
          </div>
        </div>
        <div style={styles.chatInputArea}>
          <input type="text" placeholder="Digite uma mensagem" style={styles.chatInput} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  loginContainer: {
    height: '100vh',
    display: 'flex',
    width: '100vw', // garante que ocupe toda a largura
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e0f7fa',
  },
  loginBox: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    width: '300px',
  },
  loginTitle: {
    marginBottom: '20px',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginBottom: '12px',
    border: '1px solid #ccc',
    borderRadius: '5px',
  },
  loginButton: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  appContainer: {
    display: 'flex',
    width: '100vw', // garante que ocupe toda a largura
    height: '100vh',
    fontFamily: 'Arial, sans-serif',
  },
  sidebar: {
    width: '350px',
    backgroundColor: '#202c33',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  searchBar: {
    padding: '10px',
    borderBottom: '1px solid #2a3942',
  },
  searchInput: {
    width: '100%',
    padding: '8px',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: '#2a3942',
    color: '#fff',
  },
  chatList: {
    flex: 1,
    overflowY: 'auto',
  },
  chatItem: {
    padding: '12px',
    borderBottom: '1px solid #2a3942',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  preview: {
    margin: 0,
    fontSize: '14px',
    color: '#ccc',
  },
  time: {
    fontSize: '12px',
    color: '#aaa',
    whiteSpace: 'nowrap',
    marginLeft: '10px',
  },
  chatWindow: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#111b21',
    height: '100vh',
  },
  chatHeader: {
    padding: '15px',
    backgroundColor: '#202c33',
    color: '#fff',
    fontSize: '16px',
    borderBottom: '1px solid #2a3942',
  },
  chatMessages: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  messageBubbleGreen: {
    alignSelf: 'flex-end',
    backgroundColor: '#005c4b',
    color: '#fff',
    padding: '10px',
    borderRadius: '10px',
    maxWidth: '60%',
  },
  messageBubbleLink: {
    alignSelf: 'flex-end',
    backgroundColor: '#005c4b',
    color: '#fff',
    padding: '8px',
    borderRadius: '10px',
    maxWidth: '60%',
  },
  messageText: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    fontSize: '14px',
  },
  chatInputArea: {
    padding: '15px',
    borderTop: '1px solid #2a3942',
    backgroundColor: '#202c33',
  },
  chatInput: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '15px',
    backgroundColor: '#2a3942',
    color: '#fff',
  },
};

export default App;
