import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatInterface from '../components/chat/ChatInterface.jsx';
import Button from '../components/ui/Button.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import './chat.css';

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, ready, navigate]);

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-muted">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="chat-shell">
      <header className="chat-topbar">
        <Button variant="ghost" onClick={() => navigate('/home')}>
          ← Voltar
        </Button>
        <div>
          <strong>Chat seguro</strong>
          <p className="text-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
            Logado como {user.username}
          </p>
        </div>
      </header>
      <ChatInterface />
    </div>
  );
}

