import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen.js';
import { ChatScreen } from './components/ChatScreen.js';
import { initializeApiConfig } from './config/api.js';

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>(''); // Store password for crypto
  const [apiReady, setApiReady] = useState(false);

  // Initialize API configuration on app start
  useEffect(() => {
    async function setupApi() {
      await initializeApiConfig();
      setApiReady(true);
    }
    setupApi();
  }, []);

  function handleLogin(authToken: string, user: string, userPassword: string) {
    setToken(authToken);
    setUsername(user);
    setPassword(userPassword); // Store password for crypto operations
  }

  function handleLogout() {
    setToken(null);
    setUsername('');
    setPassword(''); // Clear password on logout
  }

  // Show loading while API is being configured
  if (!apiReady) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔧</div>
          <h2 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Configurando...</h2>
          <p style={{ margin: 0, color: '#666' }}>Detectando servidor backend</p>
        </div>
      </div>
    );
  }

  // Se não tiver token, mostra tela de login/registro
  if (!token) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // Se tiver token, mostra tela de chat
  return (
    <ChatScreen 
      token={token} 
      username={username} 
      password={password}
      onLogout={handleLogout} 
    />
  );
}
