import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Label from '../components/ui/Label.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import './home.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout, addFriend, removeFriend, ready } = useAuth();
  const [friendName, setFriendName] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, ready, navigate]);

  const friends = useMemo(() => user?.friends ?? [], [user]);

  const handleAddFriend = (event) => {
    event.preventDefault();
    if (!friendName.trim()) {
      setFeedback({ type: 'error', message: 'Digite o nome do usuário.' });
      return;
    }
    const result = addFriend(friendName.trim());
    if (!result.success) {
      setFeedback({ type: 'error', message: result.message });
      return;
    }
    setFeedback({ type: 'success', message: result.message });
    setFriendName('');
  };

  const handleRemoveFriend = (name) => {
    removeFriend(name);
    setFeedback({ type: 'success', message: `${name} foi removido da sua lista.` });
  };

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

  const friendCount = friends.length;

  return (
    <div className="home-wrapper">
      <div className="home-container">
        <div className="home-header">
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>Olá, {user.username}!</h1>
            <p className="text-muted">Gerencie seus contatos e acesse seus grupos de conversa.</p>
          </div>
          <Button variant="outline" onClick={logout}>
            Sair
          </Button>
        </div>

        <div className="home-actions">
          <Card>
            <CardHeader>
              <CardTitle>Ir para o chat</CardTitle>
              <CardDescription>Acesse seus grupos e veja o painel criptográfico.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/chat')}>Abrir chat</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{friendCount} amigo{friendCount === 1 ? '' : 's'}</CardTitle>
              <CardDescription>Mantenha sua lista sempre atualizada.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted">Convide novos colegas para suas conversas seguras.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Adicionar amigo</CardTitle>
            <CardDescription>Informe o nome de usuário para adicioná-lo à sua rede.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddFriend} className="form-grid">
              {feedback && feedback.type === 'error' ? (
                <Alert variant="error">{feedback.message}</Alert>
              ) : null}
              {feedback && feedback.type === 'success' ? (
                <Alert variant="success">{feedback.message}</Alert>
              ) : null}
              <div>
                <Label htmlFor="friend-name">Usuário</Label>
                <Input
                  id="friend-name"
                  value={friendName}
                  onChange={(event) => setFriendName(event.target.value)}
                  placeholder="Nome de usuário"
                />
              </div>
              <Button type="submit">Adicionar</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seus amigos</CardTitle>
            <CardDescription>
              {friendCount === 0
                ? 'Você ainda não adicionou ninguém.'
                : `Você tem ${friendCount} contato${friendCount > 1 ? 's' : ''} pronto${friendCount > 1 ? 's' : ''} para conversar.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {friendCount === 0 ? (
              <div className="empty-state">Adicione amigos para começar suas conversas seguras.</div>
            ) : (
              <div className="form-grid">
                {friends.map((name) => (
                  <div key={name} className="friend-item">
                    <div className="friend-item__info">
                      <span className="friend-avatar">{name.charAt(0).toUpperCase()}</span>
                      <span>{name}</span>
                    </div>
                    <Button variant="ghost" onClick={() => handleRemoveFriend(name)}>
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

