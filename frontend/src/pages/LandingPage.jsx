import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function LandingPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (user) {
      navigate('/home', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [user, navigate, ready]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-muted">Carregando...</p>
    </div>
  );
}

